import type { Request, Response } from 'express';
import { Invoice, Client } from '../models';
import { verifyWebhookSignature, getInvoice, getContact, mapStatus } from '../lib/xero';

interface XeroEvent {
  resourceId: string;
  eventCategory: string;
  eventType: string;
}

/**
 * Public Xero webhook receiver. Mounted with a RAW body parser BEFORE the JSON
 * middleware and auth gate so the HMAC signature can be verified against the
 * exact bytes Xero sent. Returning the right status to an unsigned/invalid
 * payload also satisfies Xero's "Intent To Receive" validation handshake.
 */
export async function xeroWebhookHandler(req: Request, res: Response): Promise<void> {
  const raw: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('');
  const signature = req.header('x-xero-signature');

  if (!verifyWebhookSignature(raw, signature)) {
    res.status(401).end();
    return;
  }
  // Acknowledge immediately; process best-effort.
  res.status(200).end();

  try {
    const payload = JSON.parse(raw.toString('utf8')) as { events?: XeroEvent[] };
    const events = payload.events ?? [];
    for (const ev of events) {
      if (ev.eventCategory === 'INVOICE') await handleInvoiceEvent(ev.resourceId);
      else if (ev.eventCategory === 'CONTACT') await handleContactEvent(ev.resourceId);
    }
  } catch (err) {
    console.error('[xero-webhook] processing error:', (err as Error).message);
  }
}

/** Pull the latest invoice status from Xero and apply it locally. */
async function handleInvoiceEvent(resourceId: string): Promise<void> {
  const local = await Invoice.findOne({ xeroInvoiceId: resourceId });
  if (!local) return;
  const state = await getInvoice(resourceId);
  if (!state) return;
  local.set('xeroStatus', state.status);
  local.set('xeroLastSyncedAt', new Date().toISOString());
  const mapped = mapStatus(state.status);
  if (mapped) local.set('status', mapped);
  if (state.status === 'PAID' && state.fullyPaidOnDate) {
    local.set('paidDate', state.fullyPaidOnDate.slice(0, 10));
  }
  await local.save();
}

/** Refresh a linked client's details from Xero (Xero-originated change). */
async function handleContactEvent(resourceId: string): Promise<void> {
  const local = await Client.findOne({ xeroContactId: resourceId });
  if (!local) return;
  const contact = await getContact(resourceId);
  if (!contact) return;
  const update: Record<string, unknown> = { xeroSyncedAt: new Date().toISOString() };
  if (contact.FirstName) update.firstName = contact.FirstName;
  if (contact.LastName) update.lastName = contact.LastName;
  if (contact.EmailAddress) update.email = contact.EmailAddress.toLowerCase();
  const phone = contact.Phones?.find((p) => p.PhoneNumber)?.PhoneNumber;
  if (phone) update.phone = phone;
  // Direct model write — does not re-trigger the outbound CRUD sync hooks.
  await Client.updateOne({ _id: local._id }, { $set: update });
}
