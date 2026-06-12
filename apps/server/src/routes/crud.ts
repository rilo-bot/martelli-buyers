import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { keyFromUrl, deleteObject, hasS3 } from '../lib/s3';
import { syncClientToXero, syncInvoiceToXero } from '../lib/xeroSync';
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
    // Reclaim S3 media for every property on the deal before they're removed.
    const props = await Property.find({ dealId: id }).select('photos').lean();
    await deleteMedia(props.flatMap((p: { photos?: string[] }) => p.photos ?? []));
    await Promise.all([
      Property.deleteMany({ dealId: id }),
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

/** Build a REST CRUD router for one Mongoose model. */
export function crudRouter(resource: string, modelRef: AnyModel): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const docs = await modelRef.find().sort({ createdAt: 1 });
      res.json(docs.map((d) => d.toJSON()));
    }),
  );

  router.get(
    '/:id',
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
    asyncHandler(async (req, res) => {
      const doc = await modelRef.create(sanitize(req.body ?? {}));
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
    asyncHandler(async (req, res) => {
      const patch = sanitize(req.body ?? {});
      const doc = await modelRef.findByIdAndUpdate(req.params.id, patch, {
        new: true,
        runValidators: true,
      });
      if (!doc) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
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
