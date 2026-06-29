import { Router } from 'express';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Invoice, DueDiligence, Deal, Document, Lead } from '../models';
import { asyncHandler } from '../middleware/error';
import { requirePermission, canDownloadDoc } from '../lib/permissions';
import { presignDownload, getObjectStream, keyFromUrl, normalizeHtmlAssetUrls, hasS3 } from '../lib/s3';
import { sendMail } from '../lib/mailer';
import { env, hasEmail } from '../env';
import { buildInvoicePdf } from '../lib/pdf/invoice';
import { buildDdReportPdf } from '../lib/pdf/ddReport';
import { renderAgreementPdf, seedAgreementHtml, ensureAgreementScaffold } from '../lib/pdf/agreementHtml';
import { sendInvoiceEmail } from '../lib/invoiceEmail';
import { getCompanySettingsDto } from '../lib/companySettings';
import { recordEvent } from '../lib/audit';

export const documentsRouter = Router();

/**
 * Stream a PDF buffer to the browser. Inline by default (preview); pass
 * `attachment` to force a save dialog — callers gate that on `canDownloadDoc`.
 */
function sendPdf(res: Response, buf: Buffer, filename: string, attachment = false): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${attachment ? 'attachment' : 'inline'}; filename="${filename}"`);
  // Generated on the fly from editable content — never let a stale render cache.
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Length', buf.length);
  res.end(buf);
}

/** True for file types a browser can render inline (so non-owners can preview them). */
function isPreviewable(mime: string): boolean {
  return mime === 'application/pdf' || mime.startsWith('image/');
}

/** True when the request is asking to save the file rather than preview it. */
function wantsDownload(req: { query: Record<string, unknown> }): boolean {
  return req.query.download === '1' || req.query.download === 'true';
}

/* ─────────────────── catalogued uploads (private S3) ─────────────────── */

/**
 * GET /api/documents/:id/download — a short-lived presigned URL for a catalogued
 * upload (client/deal/property attachment). The bucket is private, so we never
 * hand out the raw S3 URL; we sign a GET for the object's real key and let the
 * browser fetch it. `?download=1` forces a save dialog (default: inline preview).
 *
 * Mounted before the generic CRUD router, so this wins over /documents/:id while
 * the bare /:id GET still falls through to the catalogue read.
 */
documentsRouter.get(
  '/:id/download',
  requirePermission('documents:view'),
  asyncHandler(async (req, res) => {
    if (!hasS3) {
      res.status(503).json({ error: 'File storage is not configured on the server.' });
      return;
    }
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    // Anti-download gate: a presigned URL lets the holder save the file, so only
    // the owner (uploader) and admins may obtain one. Everyone else previews via
    // /:id/preview, which streams inline through the server.
    if (!canDownloadDoc(req, doc.get('uploadedBy') || '')) {
      res.status(403).json({ error: 'Only the document owner can download this file. You can preview it instead.' });
      return;
    }
    // Prefer the stored object key; fall back to recovering it from the URL for
    // legacy records saved before storageKey was tracked.
    const key = doc.get('storageKey') || keyFromUrl(doc.get('url') ?? '');
    if (!key) {
      res.status(404).json({ error: 'This document has no stored file.' });
      return;
    }
    const url = await presignDownload(key, {
      filename: doc.get('name') || undefined,
      download: wantsDownload(req),
    });
    res.json({ url });
  }),
);

/**
 * GET /api/documents/:id/preview — stream a catalogued upload's bytes inline
 * through the server (NOT a presigned URL), so non-owners can preview a file
 * without ever receiving a directly-saveable link. The in-app viewer fetches
 * this via XHR and renders the result from an in-memory blob.
 */
documentsRouter.get(
  '/:id/preview',
  requirePermission('documents:view'),
  asyncHandler(async (req, res) => {
    // Reject direct browser navigations (address bar / new tab): those carry
    // Sec-Fetch-Dest: document. Only the app's fetch() path (dest: empty) gets
    // through, so a non-owner can never open a saveable inline tab.
    if (req.get('sec-fetch-dest') === 'document') {
      res.status(403).json({ error: 'Open this document inside the app.' });
      return;
    }
    if (!hasS3) {
      res.status(503).json({ error: 'File storage is not configured on the server.' });
      return;
    }
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      res.status(404).json({ error: 'Document not found.' });
      return;
    }
    const mime = doc.get('mimeType') || '';
    // A browser can't render Word/Excel/etc. inline — it would just download
    // them. So for non-previewable types, restrict to owners/admins.
    if (!isPreviewable(mime) && !canDownloadDoc(req, doc.get('uploadedBy') || '')) {
      res.status(403).json({ error: 'This file type can’t be previewed. Only the owner can download it.' });
      return;
    }
    const key = doc.get('storageKey') || keyFromUrl(doc.get('url') ?? '');
    if (!key) {
      res.status(404).json({ error: 'This document has no stored file.' });
      return;
    }
    const { body, contentType, contentLength } = await getObjectStream(key);
    res.setHeader('Content-Type', mime || contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    body.pipe(res);
  }),
);

/* ───────────────────────── invoices ──────────────────────────────────── */

/** GET /api/documents/invoice/:id.pdf — download a GST invoice PDF. */
documentsRouter.get(
  '/invoice/:id.pdf',
  requirePermission('invoices:view'),
  asyncHandler(async (req, res) => {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    const deal = invoice.dealId ? await Deal.findById(invoice.dealId) : null;
    const download = wantsDownload(req);
    if (download && !canDownloadDoc(req, deal?.get('assignedTo') ?? '')) {
      res.status(403).json({ error: 'Only the assigned agent or an admin can download this invoice. You can preview it instead.' });
      return;
    }
    const settings = await getCompanySettingsDto();
    const buf = await buildInvoicePdf(invoice.toJSON() as never, (deal?.toJSON() ?? {
      clientName: '', clientEmail: '',
    }) as never, settings);
    sendPdf(res, buf, `${invoice.invoiceNumber || 'invoice'}.pdf`, download);
  }),
);

/** POST /api/documents/invoice/:id/email — email the invoice PDF to the client. */
documentsRouter.post(
  '/invoice/:id/email',
  requirePermission('invoices:send'),
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
  requirePermission('invoices:send'),
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
  requirePermission('dueDiligence:view'),
  asyncHandler(async (req, res) => {
    const record = await DueDiligence.findById(req.params.id);
    if (!record) {
      res.status(404).json({ error: 'DD record not found.' });
      return;
    }
    const download = wantsDownload(req);
    if (download) {
      // A DD record has no owner of its own — use the linked journey's agent.
      const ddDeal = record.dealId ? await Deal.findById(record.dealId) : null;
      if (!canDownloadDoc(req, ddDeal?.get('assignedTo') ?? '')) {
        res.status(403).json({ error: 'Only the assigned agent or an admin can download this report. You can preview it instead.' });
        return;
      }
    }
    const buf = await buildDdReportPdf(record.toJSON() as never, await getCompanySettingsDto());
    if (!record.reportGenerated) {
      record.set('reportGenerated', true);
      await record.save();
    }
    const safe = (record.address || 'dd-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    sendPdf(res, buf, `dd-report-${safe}.pdf`, download);
  }),
);

/* ───────────────────────── agreement ─────────────────────────────────── */

/**
 * GET /api/documents/agreement/:dealId/content — the editable rich-HTML body for
 * the WYSIWYG editor. On first open (empty body) we seed it from the legacy
 * defaults + deal data and persist it once, so the field becomes the single
 * source of truth. Signed agreements are returned locked (read-only).
 */
documentsRouter.get(
  '/agreement/:dealId/content',
  requirePermission('journeys:view'),
  asyncHandler(async (req, res) => {
    const deal = await Deal.findById(req.params.dealId);
    if (!deal) {
      res.status(404).json({ error: 'Buyer journey not found.' });
      return;
    }
    // Lazy seed / upgrade (skip signed deals — those stay frozen on the render
    // they were signed against). New deals get the full body; older ones get any
    // missing scaffold (header, signature block, footer) added non-destructively.
    if (deal.agreementStatus !== 'signed') {
      const settings = await getCompanySettingsDto();
      if (!deal.agreementBodyHtml) {
        deal.set('agreementBodyHtml', seedAgreementHtml(deal.toJSON() as never, settings));
        await deal.save();
      } else {
        const { html, changed } = ensureAgreementScaffold(deal.agreementBodyHtml, settings);
        if (changed) {
          deal.set('agreementBodyHtml', html);
          await deal.save();
        }
      }
    }
    res.json({
      bodyHtml: normalizeHtmlAssetUrls(deal.agreementBodyHtml || ''),
      locked: deal.agreementStatus === 'signed',
    });
  }),
);

/** GET /api/documents/agreement/:dealId.pdf — staff preview of the agreement. */
documentsRouter.get(
  '/agreement/:dealId.pdf',
  requirePermission('journeys:view'),
  asyncHandler(async (req, res) => {
    const deal = await Deal.findById(req.params.dealId);
    if (!deal) {
      res.status(404).json({ error: 'Buyer journey not found.' });
      return;
    }
    const download = wantsDownload(req);
    if (download && !canDownloadDoc(req, deal.get('assignedTo') ?? '')) {
      res.status(403).json({ error: 'Only the assigned agent or an admin can download this agreement. You can preview it instead.' });
      return;
    }
    const buf = await renderAgreementPdf(deal.toJSON() as never, { signed: deal.agreementStatus === 'signed' }, await getCompanySettingsDto());
    sendPdf(res, buf, 'agency-agreement.pdf', download);
  }),
);

/** POST /api/documents/agreement/:dealId/send — create a sign link + email the client. */
documentsRouter.post(
  '/agreement/:dealId/send',
  requirePermission('journeys:edit'),
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
      const buf = await renderAgreementPdf(deal.toJSON() as never, { signed: false }, await getCompanySettingsDto());
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

/* ─────────────────── lead agreement (pre-conversion) ─────────────────────
 * The buyer's agency agreement is authored, sent and e-signed while the record
 * is still a Lead — signing it is what converts the lead to a client + journey.
 * These mirror the deal endpoints above but operate on a Lead; the PDF builder
 * runs off a deal-shaped adapter (name/contact/requirements from the lead, with
 * neutral default fee wording since the fee is agreed later on the journey).
 * --------------------------------------------------------------------------- */

type LeadDoc = InstanceType<typeof Lead>;

/** Adapt a Lead into the deal-shaped object the agreement builder expects. */
function leadAgreementSubject(lead: LeadDoc): Record<string, unknown> {
  return {
    ...(lead.toJSON() as Record<string, unknown>),
    clientName: `${lead.get('firstName') ?? ''} ${lead.get('lastName') ?? ''}`.trim(),
    clientEmail: lead.get('email') ?? '',
    clientPhone: lead.get('phone') ?? '',
    brief: lead.get('notes') ?? '',
    // No fee at the lead stage → the builder renders neutral default fee wording.
    fee: 0,
    feeType: '',
  };
}

/** GET /api/documents/lead-agreement/:leadId/content — editable body for the WYSIWYG editor. */
documentsRouter.get(
  '/lead-agreement/:leadId/content',
  requirePermission('leads:view'),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }
    if (lead.agreementStatus !== 'signed') {
      const settings = await getCompanySettingsDto();
      if (!lead.agreementBodyHtml) {
        lead.set('agreementBodyHtml', seedAgreementHtml(leadAgreementSubject(lead) as never, settings));
        await lead.save();
      } else {
        const { html, changed } = ensureAgreementScaffold(lead.agreementBodyHtml, settings);
        if (changed) {
          lead.set('agreementBodyHtml', html);
          await lead.save();
        }
      }
    }
    res.json({
      bodyHtml: normalizeHtmlAssetUrls(lead.agreementBodyHtml || ''),
      locked: lead.agreementStatus === 'signed',
    });
  }),
);

/** GET /api/documents/lead-agreement/:leadId.pdf — staff preview of the lead agreement. */
documentsRouter.get(
  '/lead-agreement/:leadId.pdf',
  requirePermission('leads:view'),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }
    const download = wantsDownload(req);
    if (download && !canDownloadDoc(req, lead.get('assignedTo') ?? '')) {
      res.status(403).json({ error: 'Only the assigned agent or an admin can download this agreement. You can preview it instead.' });
      return;
    }
    const buf = await renderAgreementPdf(leadAgreementSubject(lead) as never, { signed: lead.agreementStatus === 'signed' }, await getCompanySettingsDto());
    sendPdf(res, buf, 'agency-agreement.pdf', download);
  }),
);

/** POST /api/documents/lead-agreement/:leadId/send — create a sign link + email the buyer. */
documentsRouter.post(
  '/lead-agreement/:leadId/send',
  requirePermission('leads:edit'),
  asyncHandler(async (req, res) => {
    const lead = await Lead.findById(req.params.leadId);
    if (!lead) {
      res.status(404).json({ error: 'Lead not found.' });
      return;
    }
    if (!lead.get('email')) {
      res.status(400).json({ error: 'No email on this lead.' });
      return;
    }
    // Reuse an existing token so resends keep the same link.
    let token = lead.agreementSignToken;
    if (!token) token = randomUUID().replace(/-/g, '');
    lead.set('agreementSignToken', token);
    lead.set('agreementStatus', lead.agreementStatus === 'signed' ? 'signed' : 'sent');
    lead.set('agreementSentAt', new Date().toISOString());
    // Reflect "agreement sent" on the lead pipeline status (unless already won/lost).
    if (!['won', 'lost'].includes(lead.get('status'))) lead.set('status', 'agreement_sent');
    await lead.save();

    const signUrl = `${env.CLIENT_ORIGIN}/sign/${token}`;

    if (hasEmail) {
      const buf = await renderAgreementPdf(leadAgreementSubject(lead) as never, { signed: false }, await getCompanySettingsDto());
      await sendMail({
        to: lead.get('email'),
        subject: 'Your Buyer’s Agency Agreement — please review and sign',
        text: `Hi ${lead.get('firstName') || 'there'},\n\nPlease review and sign your buyer's agency agreement using the secure link below:\n\n${signUrl}\n\nA copy is attached for your records. You are welcome to seek independent legal advice before signing.\n\nKind regards,\nMartelli Buyers Agents`,
        attachments: [{ filename: 'agency-agreement.pdf', content: buf, type: 'application/pdf' }],
      });
    }

    res.json({ ok: true, signUrl, emailed: hasEmail });
  }),
);
