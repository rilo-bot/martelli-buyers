import { Router } from 'express';
import { PERMISSION_MODULES } from '@rilo/shared';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { keyFromUrl, deleteObject, hasS3 } from '../lib/s3';
import { syncClientToXero, syncInvoiceToXero } from '../lib/xeroSync';
import { recordEvent } from '../lib/audit';
import {
  type AnyModel,
  Property,
  OffMarketProperty,
  Invoice,
  DueDiligence,
  EmailCampaign,
  AISummary,
  ClientComment,
  Lead,
  Deal,
  Client,
  Offer,
  Task,
  Purchase,
} from '../models';

// Fields the server owns — never accept them from the client on write.
const STRIP = ['id', '_id', '__v', 'createdAt', 'updatedAt'] as const;
function sanitize(body: Record<string, unknown>): Record<string, unknown> {
  const out = { ...body };
  for (const k of STRIP) delete out[k];
  return out;
}

/**
 * Best-effort removal of uploaded media objects from S3. Never throws — orphan
 * cleanup must not block the delete the user actually asked for.
 */
async function deleteMedia(urls: string[]): Promise<void> {
  if (!hasS3 || urls.length === 0) return;
  await Promise.all(
    urls.map(async (url) => {
      const key = keyFromUrl(url);
      if (key) await deleteObject(key).catch(() => {});
    }),
  );
}

/**
 * Referential-integrity cleanup run BEFORE a document is deleted.
 * Keyed by REST resource name. Fixes the prototype's dangling-reference bug.
 */
const CASCADES: Record<string, (id: string) => Promise<void>> = {
  async deals(id) {
    // Reclaim S3 media for every property + offer on the deal before removal.
    const [props, offers] = await Promise.all([
      Property.find({ dealId: id }).select('photos').lean(),
      Offer.find({ dealId: id }).select('fileUrls').lean(),
    ]);
    await deleteMedia([
      ...props.flatMap((p: { photos?: string[] }) => p.photos ?? []),
      ...offers.flatMap((o: { fileUrls?: string[] }) => o.fileUrls ?? []),
    ]);
    await Promise.all([
      Property.deleteMany({ dealId: id }),
      Offer.deleteMany({ dealId: id }),
      Task.deleteMany({ dealId: id }),
      Purchase.deleteMany({ dealId: id }),
      Invoice.deleteMany({ dealId: id }),
      DueDiligence.deleteMany({ dealId: id }),
      EmailCampaign.deleteMany({ dealId: id }),
      AISummary.deleteMany({ dealId: id }),
      ClientComment.deleteMany({ dealId: id }),
      Client.updateMany({ dealIds: id }, { $pull: { dealIds: id } }),
      // Drop this deal from any off-market property's reuse list.
      OffMarketProperty.updateMany({ usedInDealIds: id }, { $pull: { usedInDealIds: id } }),
    ]);
  },
  async clients(id) {
    await Promise.all([
      Lead.updateMany({ clientId: id }, { $set: { clientId: '' } }),
      Deal.updateMany({ clientId: id }, { $set: { clientId: '' } }),
    ]);
  },
  async offers(id) {
    const offer = await Offer.findById(id).select('fileUrls').lean();
    await deleteMedia(((offer as { fileUrls?: string[] })?.fileUrls) ?? []);
  },
  async leads(id) {
    await Promise.all([
      Deal.updateMany({ leadId: id }, { $set: { leadId: '' } }),
      Client.updateMany({ leadIds: id }, { $pull: { leadIds: id } }),
    ]);
  },
  async agents(id) {
    // The agent record is referenced by id on listings sourced from them.
    // Null those links so cards fall back to the stored source name instead
    // of pointing at a deleted agent.
    await Promise.all([
      Property.updateMany({ agentId: id }, { $set: { agentId: '' } }),
      OffMarketProperty.updateMany({ sourceAgentId: id }, { $set: { sourceAgentId: '' } }),
    ]);
  },
  async properties(id) {
    const prop = await Property.findById(id).select('photos dealId offMarketPropertyId').lean();
    if (prop) {
      await deleteMedia(((prop as { photos?: string[] }).photos) ?? []);
      // If this property was sourced from the off-market database, release the link.
      const omId = (prop as { offMarketPropertyId?: string }).offMarketPropertyId;
      const dealId = (prop as { dealId?: string }).dealId;
      if (omId && dealId) {
        await OffMarketProperty.updateMany({ _id: omId }, { $pull: { usedInDealIds: dealId } });
      }
    }
    await Promise.all([
      DueDiligence.deleteMany({ propertyId: id }),
      ClientComment.deleteMany({ propertyId: id }),
    ]);
  },
};

type Doc = InstanceType<AnyModel>;

/**
 * Side-effects run AFTER a document is created. Keyed by REST resource name.
 * Used to push new records to Xero (best-effort — see lib/xeroSync).
 */
const AFTER_CREATE: Record<string, (doc: Doc) => Promise<void>> = {
  clients: (doc) => syncClientToXero(doc),
  invoices: (doc) => syncInvoiceToXero(doc),
};

/**
 * Side-effects run AFTER a document is updated, given the patch body and the
 * fresh document. Keyed by REST resource name. Used to keep denormalised
 * snapshots consistent across collections and to push changes to Xero.
 */
const AFTER_UPDATE: Record<
  string,
  (id: string, body: Record<string, unknown>, doc: Doc) => Promise<void>
> = {
  // A Deal stores a snapshot of the client's name/email/phone for fast display
  // and email sends. When the client edits those fields, fan the change out to
  // every linked deal so the snapshot never goes stale. Identity/company edits
  // also push to the linked Xero contact.
  async clients(id, body, doc) {
    const identityFields = ['firstName', 'lastName', 'email', 'phone'];
    if (identityFields.some((f) => f in body)) {
      await Deal.updateMany(
        { clientId: id },
        {
          $set: {
            clientName: `${doc.get('firstName') ?? ''} ${doc.get('lastName') ?? ''}`.trim(),
            clientEmail: doc.get('email') ?? '',
            clientPhone: doc.get('phone') ?? '',
          },
        },
      );
    }
    if ([...identityFields, 'company'].some((f) => f in body)) await syncClientToXero(doc);
  },
  // Editing an invoice updates the matching Xero draft.
  invoices: (_id, _body, doc) => syncInvoiceToXero(doc),
};

// Resources whose changes are recorded on the Buyer Journey timeline.
const AUDITED = new Set(['deals', 'offers', 'tasks', 'purchases']);

/** Record a create event. Actor name is resolved by the /api/timeline read route. */
async function auditCreate(resource: string, doc: Doc, actorId: string): Promise<void> {
  const actor = { id: actorId, name: '' };
  if (resource === 'offers') {
    await recordEvent({
      entityType: 'offer', entityId: String(doc._id), dealId: doc.get('dealId'),
      action: 'offer_created', toValue: doc.get('status'), actor,
    });
  } else if (resource === 'tasks') {
    await recordEvent({
      entityType: 'task', entityId: String(doc._id), dealId: doc.get('dealId'),
      action: 'task_created', toValue: doc.get('title'), actor,
    });
  } else if (resource === 'purchases') {
    await recordEvent({
      entityType: 'purchase', entityId: String(doc._id), dealId: doc.get('dealId'),
      action: 'purchase_created', toValue: doc.get('status'), actor,
    });
  }
}

/** Record from→to transitions on an update (deal stage/agreement, offer/purchase status, task completion). */
async function auditUpdate(resource: string, before: Doc, after: Doc, actorId: string): Promise<void> {
  const actor = { id: actorId, name: '' };
  if (resource === 'deals') {
    const id = String(after._id);
    if (after.get('stage') !== before.get('stage')) {
      await recordEvent({
        entityType: 'deal', entityId: id, dealId: id, action: 'stage_changed', field: 'stage',
        fromValue: before.get('stage'), toValue: after.get('stage'), actor,
      });
    }
    if (after.get('agreementStatus') !== before.get('agreementStatus')) {
      await recordEvent({
        entityType: 'deal', entityId: id, dealId: id, action: 'agreement_status_changed',
        field: 'agreementStatus', fromValue: before.get('agreementStatus'),
        toValue: after.get('agreementStatus'), actor,
      });
    }
  } else if (resource === 'offers') {
    if (after.get('status') !== before.get('status')) {
      await recordEvent({
        entityType: 'offer', entityId: String(after._id), dealId: after.get('dealId'),
        action: 'offer_status_changed', field: 'status', fromValue: before.get('status'),
        toValue: after.get('status'), actor,
      });
    }
  } else if (resource === 'tasks') {
    if (!before.get('completed') && after.get('completed')) {
      await recordEvent({
        entityType: 'task', entityId: String(after._id), dealId: after.get('dealId'),
        action: 'task_completed', toValue: after.get('title'), actor,
      });
    }
  } else if (resource === 'purchases') {
    if (after.get('status') !== before.get('status')) {
      await recordEvent({
        entityType: 'purchase', entityId: String(after._id), dealId: after.get('dealId'),
        action: 'purchase_status_changed', field: 'status', fromValue: before.get('status'),
        toValue: after.get('status'), actor,
      });
    }
  }
}

// Module key → set of actions it actually supports (from the shared catalog).
const MODULE_ACTIONS: Record<string, Set<string>> = Object.fromEntries(
  PERMISSION_MODULES.map((m) => [m.key, new Set<string>(m.actions)]),
);

/**
 * Resolve the permission string a CRUD action requires for a module. Modules
 * that don't define a write action (e.g. `settings` has only view/manage)
 * collapse create/edit/delete onto `:manage`.
 */
function permFor(module: string, action: 'view' | 'create' | 'edit' | 'delete'): string {
  if (action === 'view') return `${module}:view`;
  const actions = MODULE_ACTIONS[module];
  if (actions?.has(action)) return `${module}:${action}`;
  if (actions?.has('manage')) return `${module}:manage`;
  return `${module}:${action}`; // unknown → nobody but the super admin holds it
}

/** Build a REST CRUD router for one Mongoose model, gated on `${module}:${action}`. */
export function crudRouter(resource: string, modelRef: AnyModel, module: string): Router {
  const router = Router();

  router.get(
    '/',
    requirePermission(permFor(module, 'view')),
    asyncHandler(async (_req, res) => {
      const docs = await modelRef.find().sort({ createdAt: 1 });
      res.json(docs.map((d) => d.toJSON()));
    }),
  );

  router.get(
    '/:id',
    requirePermission(permFor(module, 'view')),
    asyncHandler(async (req, res) => {
      const doc = await modelRef.findById(req.params.id);
      if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.json(doc.toJSON());
    }),
  );

  router.post(
    '/',
    requirePermission(permFor(module, 'create')),
    asyncHandler(async (req, res) => {
      const doc = await modelRef.create(sanitize(req.body ?? {}));
      if (AUDITED.has(resource)) await auditCreate(resource, doc, req.session.userId ?? '');
      const afterCreate = AFTER_CREATE[resource];
      if (afterCreate) {
        await afterCreate(doc);
        // The hook may have written Xero fields straight to the DB; return fresh.
        const fresh = await modelRef.findById(doc._id);
        res.status(201).json((fresh ?? doc).toJSON());
        return;
      }
      res.status(201).json(doc.toJSON());
    }),
  );

  router.patch(
    '/:id',
    requirePermission(permFor(module, 'edit')),
    asyncHandler(async (req, res) => {
      const patch = sanitize(req.body ?? {});
      // Capture the pre-update doc when this resource records timeline events.
      const before = AUDITED.has(resource) ? await modelRef.findById(req.params.id) : null;
      const doc = await modelRef.findByIdAndUpdate(req.params.id, patch, {
        new: true,
        runValidators: true,
      });
      if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      if (before) await auditUpdate(resource, before, doc, req.session.userId ?? '');
      const afterUpdate = AFTER_UPDATE[resource];
      if (afterUpdate) {
        await afterUpdate(req.params.id, patch, doc);
        // The hook may have written Xero fields straight to the DB; return fresh.
        const fresh = await modelRef.findById(req.params.id);
        res.json((fresh ?? doc).toJSON());
        return;
      }
      res.json(doc.toJSON());
    }),
  );

  router.delete(
    '/:id',
    requirePermission(permFor(module, 'delete')),
    asyncHandler(async (req, res) => {
      const doc = await modelRef.findById(req.params.id);
      if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      const cascade = CASCADES[resource];
      if (cascade) await cascade(req.params.id);
      await doc.deleteOne();
      res.json({ ok: true });
    }),
  );

  return router;
}
