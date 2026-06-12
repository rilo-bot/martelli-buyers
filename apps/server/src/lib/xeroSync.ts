import { Client, Deal, Invoice, type AnyModel } from '../models';
import { isConnected, upsertContact, pushInvoice, updateInvoice, mapStatus } from './xero';

/**
 * Outbound Xero sync helpers, shared by the CRUD hooks and the lead-win flow so
 * both behave identically. Each is gated on an active connection and is
 * best-effort: a Xero error is logged but never thrown, so a CRM write never
 * fails because Xero is down. Writes go straight to the model (not the CRUD
 * router), so they never re-trigger the outbound hooks.
 */

type Doc = InstanceType<AnyModel>;

/** Push (or update) a CRM client as a Xero contact and link the ContactID back. */
export async function syncClientToXero(client: Doc): Promise<void> {
  try {
    if (!(await isConnected())) return;
    const contactId = await upsertContact({
      firstName: client.get('firstName'),
      lastName: client.get('lastName'),
      email: client.get('email'),
      phone: client.get('phone'),
      company: client.get('company'),
      xeroContactId: client.get('xeroContactId') || undefined,
    });
    await Client.updateOne(
      { _id: client._id },
      { $set: { xeroContactId: contactId, xeroSyncedAt: new Date().toISOString() } },
    );
  } catch (err) {
    console.error('[xero] client sync failed:', (err as Error).message);
  }
}

/**
 * Push a new invoice to Xero as a DRAFT, or update the existing draft. Attaches
 * to the deal's client contact (reusing its linked ContactID when available).
 */
export async function syncInvoiceToXero(invoice: Doc): Promise<void> {
  try {
    if (!(await isConnected())) return;
    const input = {
      invoiceNumber: invoice.get('invoiceNumber'),
      amount: invoice.get('amount'),
      dueDate: invoice.get('dueDate'),
      description: invoice.get('description'),
    };

    const existingId = invoice.get('xeroInvoiceId');
    if (existingId) {
      // Only drafts can be edited in Xero; once approved/paid we leave it alone.
      if (invoice.get('status') !== 'draft') return;
      const status = await updateInvoice(existingId, input);
      if (status) {
        await Invoice.updateOne(
          { _id: invoice._id },
          { $set: { xeroStatus: status, xeroLastSyncedAt: new Date().toISOString() } },
        );
      }
      return;
    }

    const dealId = invoice.get('dealId');
    const deal = dealId ? await Deal.findById(dealId) : null;
    const client = deal?.get('clientId') ? await Client.findById(deal.get('clientId')) : null;
    const pushed = await pushInvoice(input, {
      firstName: client?.get('firstName'),
      lastName: client?.get('lastName'),
      name: deal?.get('clientName') ?? '',
      email: client?.get('email') || deal?.get('clientEmail') || '',
      phone: client?.get('phone'),
      company: client?.get('company'),
      xeroContactId: client?.get('xeroContactId') || undefined,
    });

    const mapped = mapStatus(pushed.xeroStatus);
    await Invoice.updateOne(
      { _id: invoice._id },
      {
        $set: {
          xeroInvoiceId: pushed.xeroInvoiceId,
          xeroStatus: pushed.xeroStatus,
          xeroUrl: pushed.xeroUrl,
          xeroLastSyncedAt: new Date().toISOString(),
          invoiceNumber: pushed.invoiceNumber || invoice.get('invoiceNumber'),
          ...(mapped ? { status: mapped } : {}),
        },
      },
    );
  } catch (err) {
    console.error('[xero] invoice sync failed:', (err as Error).message);
  }
}
