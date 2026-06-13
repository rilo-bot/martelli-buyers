import { Router } from 'express';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Invoice, DueDiligence, Deal } from '../models';
import { asyncHandler } from '../middleware/error';
import { sendMail } from '../lib/mailer';
import { env, hasEmail } from '../env';
import { buildInvoicePdf } from '../lib/pdf/invoice';
import { buildDdReportPdf } from '../lib/pdf/ddReport';
import { buildAgreementPdf } from '../lib/pdf/agreement';
import { sendInvoiceEmail } from '../lib/invoiceEmail';
import { recordEvent } from '../lib/audit';

export const documentsRouter = Router();

/** Stream a PDF buffer to the browser as an inline download. */
function sendPdf(res: Response, buf: Buffer, filename: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

/* ───────────────────────── invoices ──────────────────────────────────── */

/** GET /api/documents/invoice/:id.pdf — download a GST invoice PDF. */
documentsRouter.get(
  '/invoice/:id.pdf',
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const deal = invoice.dealId ? await Deal.findById(invoice.dealId) : null;
    const buf = await buildInvoicePdf(invoice.toJSON() as never, (deal?.toJSON() ?? {
      clientName: '', clientEmail: '',
    }) as never);
    sendPdf(res, buf, `${invoice.invoiceNumber || 'invoice'}.pdf`);
  }),
);

/** POST /api/documents/invoice/:id/email — email the invoice PDF to the client. */
documentsRouter.post(
  '/invoice/:id/email',
  asyncHandler(async (req, res) => {
    if (!hasEmail) {
      res.status(503).json({ error: 'Email is not configured on the server.' });
      return;
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const deal = invoice.dealId ? await Deal.findById(invoice.dealId) : null;
    const to = deal?.clientEmail;
    if (!to) {
      res.status(400).json({ error: 'No client email on the linked buyer journey.' });
      return;
    }
    await sendInvoiceEmail(invoice.toJSON() as never, deal!.toJSON() as never);
    if (invoice.status === 'draft') {
      invoice.set('status', 'sent');
      await invoice.save();
    }
    res.json({ ok: true, status: invoice.status });
  }),
);

/** POST /api/documents/invoice/:id/remind — re-email an outstanding invoice as a reminder. */
documentsRouter.post(
  '/invoice/:id/remind',
  asyncHandler(async (req, res) => {
    if (!hasEmail) {
      res.status(503).json({ error: 'Email is not configured on the server.' });
      return;
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    if (invoice.status === 'paid') {
      res.status(400).json({ error: 'This invoice is already paid.' });
      return;
    }
    const deal = invoice.dealId ? await Deal.findById(invoice.dealId) : null;
    const to = deal?.clientEmail;
    if (!to) {
      res.status(400).json({ error: 'No client email on the linked buyer journey.' });
      return;
    }
    await sendInvoiceEmail(invoice.toJSON() as never, deal!.toJSON() as never, { reminder: true });
    // A sent invoice past its due date becomes overdue once chased.
    if (invoice.status === 'sent' && invoice.dueDate && new Date(invoice.dueDate).getTime() < Date.now()) {
      invoice.set('status', 'overdue');
    }
    invoice.set('lastReminderAt', new Date().toISOString());
    invoice.set('reminderCount', (invoice.get('reminderCount') ?? 0) + 1);
    await invoice.save();
    res.json(invoice.toJSON());
  }),
);

/* ───────────────────────── DD report ─────────────────────────────────── */

/** GET /api/documents/dd/:id/report.pdf — download the DD report PDF. */
documentsRouter.get(
  '/dd/:id/report.pdf',
  asyncHandler(async (req, res) => {
    const record = await DueDiligence.findById(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'DD record not found.' });
      return;
    }
    const buf = await buildDdReportPdf(record.toJSON() as never);
    if (!record.reportGenerated) {
      record.set('reportGenerated', true);
      await record.save();
    }
    const safe = (record.address || 'dd-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    sendPdf(res, buf, `dd-report-${safe}.pdf`);
  }),
);

/* ───────────────────────── agreement ─────────────────────────────────── */

/** GET /api/documents/agreement/:dealId.pdf — staff preview of the agreement. */
documentsRouter.get(
  '/agreement/:dealId.pdf',
  asyncHandler(async (req, res) => {
    const deal = await Deal.findById(req.params.dealId);
    if (!deal) {
      res.status(404).json({ error: 'Buyer journey not found.' });
      return;
    }
    const buf = await buildAgreementPdf(deal.toJSON() as never, { signed: deal.agreementStatus === 'signed' });
    sendPdf(res, buf, 'agency-agreement.pdf');
  }),
);

/** POST /api/documents/agreement/:dealId/send — create a sign link + email the client. */
documentsRouter.post(
  '/agreement/:dealId/send',
  asyncHandler(async (req, res) => {
    const deal = await Deal.findById(req.params.dealId);
    if (!deal) {
      res.status(404).json({ error: 'Buyer journey not found.' });
      return;
    }
    if (!deal.clientEmail) {
      res.status(400).json({ error: 'No client email on this buyer journey.' });
      return;
    }
    // Reuse an existing token (so resends keep the same link) unless none yet.
    const prevStatus = deal.agreementStatus;
    let token = deal.agreementSignToken;
    if (!token) token = randomUUID().replace(/-/g, '');
    deal.set('agreementSignToken', token);
    deal.set('agreementStatus', deal.agreementStatus === 'signed' ? 'signed' : 'sent');
    deal.set('agreementSentAt', new Date().toISOString());
    await deal.save();

    if (prevStatus !== 'signed') {
      await recordEvent({
        entityType: 'deal', entityId: deal.id, dealId: deal.id,
        action: 'agreement_sent', field: 'agreementStatus', fromValue: prevStatus, toValue: 'sent',
        actor: { id: req.session.userId ?? '', name: '' },
      });
    }

    const signUrl = `${env.CLIENT_ORIGIN}/sign/${token}`;

    if (hasEmail) {
      const buf = await buildAgreementPdf(deal.toJSON() as never, { signed: false });
      await sendMail({
        to: deal.clientEmail,
        subject: 'Your Buyer’s Agency Agreement — please review and sign',
        text: `Hi ${deal.clientName || 'there'},\n\nPlease review and sign your buyer's agency agreement using the secure link below:\n\n${signUrl}\n\nA copy is attached for your records. You are welcome to seek independent legal advice before signing.\n\nKind regards,\nMartelli Buyers Agents`,
        attachments: [{ filename: 'agency-agreement.pdf', content: buf, type: 'application/pdf' }],
      });
    }

    res.json({ ok: true, signUrl, emailed: hasEmail });
  }),
);
