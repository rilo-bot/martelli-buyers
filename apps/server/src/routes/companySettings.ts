import { Router } from 'express';
import { Buffer } from 'node:buffer';
import type { CompanySettings } from '@rilo/shared';
import { COMPANY_SETTINGS_DEFAULTS } from '@rilo/shared';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { getCompanySettings } from '../lib/companySettings';
import { imageRenders } from '../lib/pdf/base';
import { buildInvoicePdf } from '../lib/pdf/invoice';

export const companySettingsRouter = Router();

/** Max decoded size for an embedded logo (keeps PDFs and the settings doc small). */
const MAX_LOGO_BYTES = 500 * 1024;

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

/**
 * Validate + normalise a PUT body into the set of fields to apply. Only keys
 * present in the body are returned, so the client may send a full object or a
 * subset. Throws {@link ValidationError} (→ 400) on any invalid value. Exported
 * so the live-preview endpoint can validate draft settings the same way.
 */
export function sanitizeCompanySettings(body: unknown): Record<string, string | number> {
  if (!body || typeof body !== 'object') throw new ValidationError('Invalid request body.');
  const src = body as Record<string, unknown>;
  const out: Record<string, string | number> = {};

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
    let updates: Record<string, string | number>;
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
    let draft: Record<string, string | number>;
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
