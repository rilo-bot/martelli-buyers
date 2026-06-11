import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import {
  type AnyModel,
  Property,
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
 * Referential-integrity cleanup run BEFORE a document is deleted.
 * Keyed by REST resource name. Fixes the prototype's dangling-reference bug.
 */
const CASCADES: Record<string, (id: string) => Promise<void>> = {
  async deals(id) {
    await Promise.all([
      Property.deleteMany({ dealId: id }),
      Invoice.deleteMany({ dealId: id }),
      DueDiligence.deleteMany({ dealId: id }),
      EmailCampaign.deleteMany({ dealId: id }),
      AISummary.deleteMany({ dealId: id }),
      ClientComment.deleteMany({ dealId: id }),
      Client.updateMany({ dealIds: id }, { $pull: { dealIds: id } }),
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
  async properties(id) {
    await Promise.all([
      DueDiligence.deleteMany({ propertyId: id }),
      ClientComment.deleteMany({ propertyId: id }),
    ]);
  },
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
      res.status(201).json(doc.toJSON());
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const doc = await modelRef.findByIdAndUpdate(
        req.params.id,
        sanitize(req.body ?? {}),
        { new: true, runValidators: true },
      );
      if (!doc) {
        res.status(404).json({ error: 'Not found' });
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
