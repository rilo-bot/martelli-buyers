import { Router } from 'express';
import { Buffer } from 'node:buffer';
import type { CompanySettings, DDChecklistTemplateItem } from '@rilo/shared';
import { COMPANY_SETTINGS_DEFAULTS } from '@rilo/shared';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { getCompanySettings } from '../lib/companySettings';
import { imageRenders } from '../lib/pdf/base';
import { buildInvoicePdf } from '../lib/pdf/invoice';
import { sanitizeEmailHtml, renderBrandedEmail } from '../lib/email/render';

export const companySettingsRouter = Router();

/** Max decoded size for an embedded logo (keeps PDFs and the settings doc small). */
const MAX_LOGO_BYTES = 500 * 1024;

/** Max length of the stored (sanitised) email signature HTML. */
const MAX_SIGNATURE_CHARS = 5000;

/** Bounds for the DD audit-checklist template (keeps the settings doc small). */
const MAX_DD_CHECKLIST_ITEMS = 100;
const MAX_DD_CHECKLIST_LABEL = 200;
const MAX_DD_CHECKLIST_SECTION = 120;

// Editable string fields → max length. Values are trimmed and capped.
const STRING_FIELDS: Record<string, number> = {
  firmName: 200,
  firmAddress: 300,
  firmLicence: 200,
  gstNumber: 50,
  bankDetails: 1000,
  invoiceTitle: 60,
  invoicePaymentTerms: 200,
  invoiceDefaultDescription: 200,
  invoiceFooterText: 1000,
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const LOGO_DATA_URL = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/;

export class ValidationError extends Error {}

/** A normalised settings value — primitives, plus the DD checklist template array. */
type SettingsValue = string | number | boolean | DDChecklistTemplateItem[];

/**
 * Validate + normalise a PUT body into the set of fields to apply. Only keys
 * present in the body are returned, so the client may send a full object or a
 * subset. Throws {@link ValidationError} (→ 400) on any invalid value. Exported
 * so the live-preview endpoint can validate draft settings the same way.
 */
export function sanitizeCompanySettings(body: unknown): Record<string, SettingsValue> {
  if (!body || typeof body !== 'object') throw new ValidationError('Invalid request body.');
  const src = body as Record<string, unknown>;
  const out: Record<string, SettingsValue> = {};

  for (const [field, max] of Object.entries(STRING_FIELDS)) {
    if (src[field] === undefined) continue;
    if (typeof src[field] !== 'string') throw new ValidationError(`${field} must be a string.`);
    out[field] = (src[field] as string).trim().slice(0, max);
  }

  if (src.brandColor !== undefined) {
    const c = String(src.brandColor).trim();
    if (!HEX_COLOR.test(c)) throw new ValidationError('Brand colour must be a #rrggbb hex value.');
    out.brandColor = c;
  }

  if (src.logoDataUrl !== undefined) {
    const raw = String(src.logoDataUrl).trim();
    if (raw === '') {
      out.logoDataUrl = '';
    } else {
      const match = LOGO_DATA_URL.exec(raw);
      if (!match) throw new ValidationError('Logo must be a PNG or JPEG data URL.');
      const bytes = Buffer.byteLength(match[2], 'base64');
      if (bytes > MAX_LOGO_BYTES) throw new ValidationError('Logo must be smaller than 500 KB.');
      out.logoDataUrl = raw;
    }
  }

  if (src.gstRate !== undefined) {
    const n = Number(src.gstRate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      throw new ValidationError('GST rate must be a number between 0 and 100.');
    }
    out.gstRate = n;
  }

  // ── Email branding ──
  if (src.emailLogoUrl !== undefined) {
    const url = String(src.emailLogoUrl).trim();
    if (url !== '' && !/^https:\/\/.+/i.test(url)) {
      throw new ValidationError('Email logo must be a hosted https URL.');
    }
    out.emailLogoUrl = url;
  }

  if (src.emailSignatureHtml !== undefined) {
    if (typeof src.emailSignatureHtml !== 'string') {
      throw new ValidationError('emailSignatureHtml must be a string.');
    }
    // Sanitise on the way in so stored HTML is always safe, then cap length.
    out.emailSignatureHtml = sanitizeEmailHtml(src.emailSignatureHtml).slice(0, MAX_SIGNATURE_CHARS);
  }

  if (src.emailBrandingEnabled !== undefined) {
    out.emailBrandingEnabled = Boolean(src.emailBrandingEnabled);
  }

  // ── Due Diligence audit-checklist template ──
  if (src.ddChecklistTemplate !== undefined) {
    if (!Array.isArray(src.ddChecklistTemplate)) {
      throw new ValidationError('Checklist template must be a list.');
    }
    if (src.ddChecklistTemplate.length > MAX_DD_CHECKLIST_ITEMS) {
      throw new ValidationError(`Checklist cannot exceed ${MAX_DD_CHECKLIST_ITEMS} items.`);
    }
    const seen = new Set<string>();
    const items: DDChecklistTemplateItem[] = src.ddChecklistTemplate.map((raw, idx) => {
      if (!raw || typeof raw !== 'object') throw new ValidationError(`Checklist item ${idx + 1} is invalid.`);
      const item = raw as Record<string, unknown>;
      const id = typeof item.id === 'string' ? item.id.trim() : '';
      if (!id) throw new ValidationError(`Checklist item ${idx + 1} is missing an id.`);
      if (seen.has(id)) throw new ValidationError(`Duplicate checklist item id "${id}".`);
      seen.add(id);
      const label = typeof item.label === 'string' ? item.label.trim().slice(0, MAX_DD_CHECKLIST_LABEL) : '';
      if (!label) throw new ValidationError(`Checklist item ${idx + 1} needs a label.`);
      const section = typeof item.section === 'string' ? item.section.trim().slice(0, MAX_DD_CHECKLIST_SECTION) : '';
      return { id, label, section, enabled: item.enabled === undefined ? true : Boolean(item.enabled) };
    });
    // At least one enabled item, or new DD records would have an empty checklist
    // that can never be marked complete (blocking the buyer journey forever).
    if (!items.some((i) => i.enabled)) {
      throw new ValidationError('Keep at least one checklist item enabled.');
    }
    out.ddChecklistTemplate = items;
  }

  return out;
}

/** GET /api/company-settings — the org-wide settings (read by any staff member). */
companySettingsRouter.get(
  '/',
  requirePermission('settings:view'),
  asyncHandler(async (_req, res) => {
    const doc = await getCompanySettings();
    res.json(doc.toJSON());
  }),
);

/** PUT /api/company-settings — update the settings (admins only). */
companySettingsRouter.put(
  '/',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    let updates: Record<string, SettingsValue>;
    try {
      updates = sanitizeCompanySettings(req.body);
    } catch (err) {
      res.status(400).json({ error: err instanceof ValidationError ? err.message : 'Invalid settings.' });
      return;
    }
    // A logo that passes format/size checks can still be undecodable and would
    // crash every PDF download (pdfkit decodes lazily). Probe-render it now and
    // reject if it can't be embedded.
    if (typeof updates.logoDataUrl === 'string' && updates.logoDataUrl !== '') {
      if (!(await imageRenders(updates.logoDataUrl))) {
        res.status(400).json({ error: 'That logo image could not be processed. Please upload a valid PNG or JPEG.' });
        return;
      }
    }
    const doc = await getCompanySettings();
    doc.set(updates);
    await doc.save();
    res.json(doc.toJSON());
  }),
);

/**
 * POST /api/company-settings/preview.pdf — render a sample invoice from the
 * supplied (possibly unsaved) settings so admins can preview their changes
 * before saving. Validated the same way as a real save.
 */
companySettingsRouter.post(
  '/preview.pdf',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    let draft: Record<string, SettingsValue>;
    try {
      draft = sanitizeCompanySettings(req.body);
    } catch (err) {
      res.status(400).json({ error: err instanceof ValidationError ? err.message : 'Invalid settings.' });
      return;
    }
    if (typeof draft.logoDataUrl === 'string' && draft.logoDataUrl !== '' && !(await imageRenders(draft.logoDataUrl))) {
      res.status(400).json({ error: 'That logo image could not be processed. Please upload a valid PNG or JPEG.' });
      return;
    }

    // Representative sample invoice; GST derived from the draft rate so the
    // preview's "GST (x%)" line reflects the configured rate.
    const rate = typeof draft.gstRate === 'number' ? draft.gstRate : COMPANY_SETTINGS_DEFAULTS.gstRate;
    const amount = 2000;
    const now = new Date();
    const due = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sampleInvoice = {
      invoiceNumber: 'INV-PREVIEW', type: 'engagement', amount,
      gst: +(amount * (rate / 100)).toFixed(2), total: +(amount * (1 + rate / 100)).toFixed(2),
      status: 'draft', dueDate: due.toISOString(), description: '', createdAt: now.toISOString(),
    };
    const sampleDeal = { clientName: 'Sample Client', clientEmail: 'client@example.com' };

    const buf = await buildInvoicePdf(sampleInvoice, sampleDeal, draft as Partial<CompanySettings>);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="invoice-preview.pdf"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }),
);

/**
 * POST /api/company-settings/email-preview — render a sample branded email from
 * the supplied (possibly unsaved) settings so admins can preview their email
 * branding before saving. Returns HTML (mirrors the invoice preview.pdf flow).
 */
const SAMPLE_EMAIL_BODY =
  '<h2>Hello Alex,</h2>' +
  '<p>This is a preview of how your <strong>branded emails</strong> will look. ' +
  'Formatting like <span style="color:#1e6fb0">colour</span>, <em>italics</em> and ' +
  '<a href="https://example.com">links</a> are supported.</p>' +
  '<ul><li>Your logo and brand colour frame every message.</li>' +
  '<li>Your signature is appended automatically.</li></ul>' +
  '<p>Kind regards,</p>';

companySettingsRouter.post(
  '/email-preview',
  requirePermission('settings:manage'),
  asyncHandler(async (req, res) => {
    let draft: Record<string, SettingsValue>;
    try {
      draft = sanitizeCompanySettings(req.body);
    } catch (err) {
      res.status(400).json({ error: err instanceof ValidationError ? err.message : 'Invalid settings.' });
      return;
    }
    const html = renderBrandedEmail({
      bodyHtml: SAMPLE_EMAIL_BODY,
      settings: draft as Partial<CompanySettings>,
    });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(html);
  }),
);
