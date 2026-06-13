import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { Lead, Deal, Client } from '../models';
import { syncClientToXero } from '../lib/xeroSync';

export const leadsRouter = Router();

/**
 * Convert a won lead into a client + deal in a single server-owned operation.
 *
 * Doing this server-side (instead of 5 separate browser round-trips) makes the
 * conversion ordered, de-duplicated, and recoverable:
 *  - "existing" mode links to a chosen client; "new" mode reuses a client with
 *    the same email if one already exists (dedupe) before creating one.
 *  - if deal creation fails after we just created a client, that client is
 *    rolled back so a failed win never leaves an orphan profile.
 *  - cross-links use $addToSet so re-running is idempotent.
 *
 * Returns the three affected records so the client can sync its stores from the
 * authoritative server state.
 */
leadsRouter.post(
  '/:id/win',
  requirePermission('leads:edit'),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }

    const body = (req.body ?? {}) as { clientMode?: string; existingClientId?: string };
    const mode = body.clientMode === 'existing' ? 'existing' : 'new';

    // 1. Resolve the client.
    let client;
    let clientCreated = false;

    if (mode === 'existing') {
      const cid = String(body.existingClientId ?? '');
      client = cid ? await Client.findById(cid) : null;
      if (!client) {
        res.status(400).json({ error: 'Selected client not found.' });
        return;
      }
    } else {
      const email = (lead.email ?? '').trim().toLowerCase();
      client = email ? await Client.findOne({ email }) : null;
      if (!client) {
        client = await Client.create({
          firstName: lead.firstName,
          lastName: lead.lastName,
          email,
          phone: lead.phone,
          leadIds: [lead.id],
          assignedTo: lead.assignedTo ?? '',
        });
        clientCreated = true;
      }
    }

    // 2. Create the deal in the first pipeline stage. Roll back a brand-new
    //    client if this fails so we never strand an orphan profile.
    let deal;
    try {
      deal = await Deal.create({
        leadId: lead.id,
        clientId: client.id,
        clientName: `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim(),
        clientEmail: lead.email,
        clientPhone: lead.phone,
        stage: 'qualification',
        brief: lead.notes,
        budget: lead.budget,
        preferredSuburbs: lead.preferredSuburbs,
        propertyType: lead.propertyType,
        bedrooms: lead.bedrooms,
        bathrooms: lead.bathrooms,
        assignedTo: lead.assignedTo ?? '',
      });
    } catch (err) {
      if (clientCreated) await Client.findByIdAndDelete(client.id).catch(() => {});
      throw err;
    }

    // 3. Cross-link (idempotent) and finalise the lead.
    const updatedClient = await Client.findByIdAndUpdate(
      client.id,
      { $addToSet: { dealIds: deal.id, leadIds: lead.id } },
      { new: true },
    );
    lead.set({ status: 'won', clientId: client.id });
    await lead.save();

    // Best-effort push the (possibly new) client to Xero — won clients should
    // appear as Xero contacts too, just like clients created via the CRUD route.
    if (updatedClient) await syncClientToXero(updatedClient);

    res.json({
      lead: lead.toJSON(),
      deal: deal.toJSON(),
      client: (updatedClient ?? client).toJSON(),
      clientCreated,
    });
  }),
);
