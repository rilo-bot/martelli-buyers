import { Client, Invoice, XeroConnection } from '../models';
import { getConnection, listContacts, listInvoices, mapStatus, type XeroContact } from './xero';

/**
 * One-way pull from Xero into the CRM, run on first connect and on demand.
 * - Contacts → Clients: dedupe by xeroContactId then email; link-only when a
 *   client already exists (never overwrite CRM fields); create when missing.
 * - Invoices → link: backfill xeroInvoiceId/status onto invoices the CRM already
 *   has (match by xeroInvoiceId then invoiceNumber). Never creates orphans.
 *
 * All writes go straight to the models, so the CRUD outbound hooks never fire —
 * imported data is not pushed back to Xero. Re-running is idempotent.
 */

/** Split a Xero contact into first/last name, preferring its structured fields. */
function nameParts(c: XeroContact): { firstName: string; lastName: string } {
  if (c.FirstName || c.LastName) {
    return { firstName: c.FirstName ?? '', lastName: c.LastName ?? '' };
  }
  const parts = (c.Name ?? '').trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function primaryPhone(c: XeroContact): string {
  return c.Phones?.find((p) => p.PhoneNumber)?.PhoneNumber ?? '';
}

const deepLink = (id: string, status: string) =>
  `https://go.xero.com/app/invoicing/${status === 'DRAFT' ? 'edit' : 'view'}/${id}`;

/** Import contacts as clients (link-only on match). Returns the count of NEW clients. */
async function importContacts(): Promise<number> {
  const contacts = await listContacts();
  let created = 0;
  for (const c of contacts) {
    const email = (c.EmailAddress ?? '').trim().toLowerCase();
    // Match by linked ContactID first, then by email.
    let client = await Client.findOne({ xeroContactId: c.ContactID });
    if (!client && email) client = await Client.findOne({ email });

    if (client) {
      // Link only — do not overwrite existing CRM fields.
      if (!client.get('xeroContactId')) {
        await Client.updateOne(
          { _id: client._id },
          { $set: { xeroContactId: c.ContactID, xeroSyncedAt: new Date().toISOString() } },
        );
      }
      continue;
    }

    const { firstName, lastName } = nameParts(c);
    await Client.create({
      firstName,
      lastName,
      email,
      phone: primaryPhone(c),
      company: c.Name ?? '',
      xeroContactId: c.ContactID,
      xeroSyncedAt: new Date().toISOString(),
    });
    created++;
  }
  return created;
}

/** Link Xero invoices onto invoices the CRM already has. Returns the count linked. */
async function linkInvoices(): Promise<number> {
  const invoices = await listInvoices();
  let linked = 0;
  for (const xi of invoices) {
    // Find a local invoice by Xero ID, else by invoice number / reference.
    let local = await Invoice.findOne({ xeroInvoiceId: xi.InvoiceID });
    if (!local) {
      const ref = (xi.InvoiceNumber || xi.Reference || '').trim();
      if (ref) local = await Invoice.findOne({ invoiceNumber: ref });
    }
    if (!local) continue; // no orphan invoices created

    const mapped = mapStatus(xi.Status);
    await Invoice.updateOne(
      { _id: local._id },
      {
        $set: {
          xeroInvoiceId: xi.InvoiceID,
          xeroStatus: xi.Status,
          xeroUrl: deepLink(xi.InvoiceID, xi.Status),
          xeroLastSyncedAt: new Date().toISOString(),
          ...(mapped ? { status: mapped } : {}),
          ...(xi.Status === 'PAID' && xi.FullyPaidOnDate
            ? { paidDate: xi.FullyPaidOnDate.slice(0, 10) }
            : {}),
        },
      },
    );
    linked++;
  }
  return linked;
}

/** Run the full contact + invoice import, tracking progress on the connection. */
export async function runInitialImport(_connectedByEmail: string): Promise<void> {
  const conn = await getConnection();
  if (!conn) return;

  await XeroConnection.updateOne({ _id: conn._id }, { $set: { importStatus: 'running', importError: '' } });
  try {
    const importedClients = await importContacts();
    const linkedInvoices = await linkInvoices();
    await XeroConnection.updateOne(
      { _id: conn._id },
      {
        $set: {
          importStatus: 'done',
          lastImportAt: new Date().toISOString(),
          importedClients,
          linkedInvoices,
          importError: '',
        },
      },
    );
  } catch (err) {
    await XeroConnection.updateOne(
      { _id: conn._id },
      { $set: { importStatus: 'error', importError: (err as Error).message } },
    );
  }
}
