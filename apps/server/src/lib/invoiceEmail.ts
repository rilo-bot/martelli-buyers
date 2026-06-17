import { sendMail } from './mailer';
import { buildInvoicePdf } from './pdf/invoice';
import { getCompanySettingsDto } from './companySettings';

/** Fields needed to render + email an invoice (a serialized Invoice document). */
export interface InvoiceEmailData {
  invoiceNumber: string;
  type: string;
  amount: number;
  gst: number;
  total: number;
  status: string;
  dueDate: string;
  description: string;
  createdAt?: string;
}

export interface InvoiceEmailDeal {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
}

/**
 * Build the invoice PDF and email it to the client — normal send or an overdue
 * reminder. Single source of truth for the email endpoint, the manual reminder
 * route, and the automated scheduler. Caller is responsible for any status
 * transition / reminder stamping afterwards.
 */
export async function sendInvoiceEmail(
  invoice: InvoiceEmailData,
  deal: InvoiceEmailDeal,
  opts: { reminder?: boolean } = {},
): Promise<void> {
  const buf = await buildInvoicePdf(invoice, deal, await getCompanySettingsDto());
  const num = invoice.invoiceNumber || 'invoice';
  const name = deal.clientName || 'there';

  const subject = opts.reminder
    ? `Reminder: invoice ${invoice.invoiceNumber} is outstanding`
    : `Invoice ${invoice.invoiceNumber} from Martelli Buyers Agents`;

  const text = opts.reminder
    ? `Hi ${name},\n\nThis is a friendly reminder that invoice ${invoice.invoiceNumber}` +
      `${invoice.dueDate ? ` (due ${invoice.dueDate})` : ''} is still outstanding. ` +
      `A copy is attached for your convenience.\n\n` +
      `If you've already arranged payment, please disregard this message.\n\nKind regards,\nMartelli Buyers Agents`
    : `Hi ${name},\n\nPlease find attached invoice ${invoice.invoiceNumber} for ` +
      `${invoice.description || 'buyer agency services'}.\n\nKind regards,\nMartelli Buyers Agents`;

  await sendMail({
    to: deal.clientEmail,
    subject,
    text,
    attachments: [{ filename: `${num}.pdf`, content: buf, type: 'application/pdf' }],
  });
}
