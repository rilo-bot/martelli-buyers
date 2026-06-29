import { Router } from 'express';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import type { ContactFormConfig } from '@rilo/shared';
import { asyncHandler } from '../middleware/error';
import { getCompanySettings, settingsToClient } from '../lib/companySettings';
import {
  validateSubmission,
  originAllowed,
  toPublicForm,
  ContactFormError,
  type SubmissionResult,
} from '../lib/contactForm';
import { ContactEnquiry } from '../models';
import { env } from '../env';

/**
 * Public, unauthenticated surface for the admin-built contact form. Drives both
 * the hosted /contact-us page and the embeddable iframe widget that third-party
 * sites load via the embed snippet.
 *
 * MOUNTED BEFORE the global (cookie) CORS so it can run its own permissive,
 * origin-reflecting CORS — embeds load from arbitrary domains. These endpoints
 * never read the session cookie, so reflecting any origin is safe. The submit
 * routes parse their own (tightly capped) JSON body because the global
 * express.json() runs later in the stack.
 */
export const contactFormPublicRouter = Router();

// Reflect any origin; embeds are cross-site by design and use no credentials.
contactFormPublicRouter.use(cors({ origin: true, methods: ['GET', 'POST', 'OPTIONS'], maxAge: 86400 }));
// Override helmet's default CORP so embed.js + the config load cross-origin.
contactFormPublicRouter.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

// Public write endpoint — cap the body hard and throttle per IP.
const submitJson = express.json({ limit: '64kb' });
const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many submissions. Please wait a moment and try again.' },
});

/** Load the form config + branding needed by the public renderer. */
async function loadConfig(): Promise<{ config: ContactFormConfig; logoDataUrl: string; firmName: string }> {
  const settings = settingsToClient(await getCompanySettings());
  return { config: settings.contactForm, logoDataUrl: settings.logoDataUrl, firmName: settings.firmName };
}

/** Bot heuristics: a filled honeypot, or a submission that arrived implausibly fast. */
function looksLikeSpam(body: Record<string, unknown>): boolean {
  if (typeof body._hp === 'string' && body._hp.trim() !== '') return true;
  const elapsed = Number(body._elapsedMs);
  if (Number.isFinite(elapsed) && elapsed >= 0 && elapsed < 1200) return true;
  return false;
}

function hostFromOrigin(origin: string | undefined): string {
  if (!origin) return '';
  try {
    return new URL(origin).hostname;
  } catch {
    return '';
  }
}

async function createEnquiry(result: SubmissionResult, source: string): Promise<{ id: string }> {
  const enquiry = await ContactEnquiry.create({
    name: result.name,
    email: result.email,
    phone: result.phone,
    enquiryType: result.enquiryType,
    budget: result.budget,
    location: result.location,
    message: result.message,
    consent: result.consent,
    extraFields: result.extraFields,
    source,
    status: 'new',
  });
  return { id: enquiry.id };
}

/** Shared submit path: validate against config → create enquiry. Spam is silently dropped. */
async function handleSubmit(config: ContactFormConfig, req: Request, res: Response, source: string): Promise<void> {
  const body = (req.body ?? {}) as Record<string, unknown>;
  // Pretend success for bots so they don't probe for the real validation rules.
  if (looksLikeSpam(body)) {
    res.status(201).json({ ok: true });
    return;
  }
  let result: SubmissionResult;
  try {
    result = validateSubmission(config, body.values);
  } catch (err) {
    res.status(400).json({ error: err instanceof ContactFormError ? err.message : 'Invalid submission.' });
    return;
  }
  const enquiry = await createEnquiry(result, source);
  res.status(201).json({ ok: true, id: enquiry.id });
}

/* ── Config reads ─────────────────────────────────────────────────────────*/

/** GET /api/public/form — config for the firm's own hosted /contact-us page. */
contactFormPublicRouter.get(
  '/form',
  asyncHandler(async (_req, res) => {
    const { config, logoDataUrl, firmName } = await loadConfig();
    res.json(toPublicForm(config, { logoDataUrl, firmName }));
  }),
);

/** GET /api/public/form/:token — config for an embed; 404 unless published + matched. */
contactFormPublicRouter.get(
  '/form/:token',
  asyncHandler(async (req, res) => {
    const { config, logoDataUrl, firmName } = await loadConfig();
    if (!config.published || !config.token || config.token !== req.params.token) {
      res.status(404).json({ error: 'Form not found.' });
      return;
    }
    res.json(toPublicForm(config, { logoDataUrl, firmName }));
  }),
);

/* ── Submissions ──────────────────────────────────────────────────────────*/

/** POST /api/public/form/submit — same-origin submit from the hosted page. */
contactFormPublicRouter.post(
  '/form/submit',
  submitLimiter,
  submitJson,
  asyncHandler(async (req, res) => {
    const { config } = await loadConfig();
    await handleSubmit(config, req, res, 'Website');
  }),
);

/** POST /api/public/form/:token/submit — embed submit; published + origin-gated. */
contactFormPublicRouter.post(
  '/form/:token/submit',
  submitLimiter,
  submitJson,
  asyncHandler(async (req, res) => {
    const { config } = await loadConfig();
    if (!config.published || !config.token || config.token !== req.params.token) {
      res.status(404).json({ error: 'Form not found.' });
      return;
    }
    const origin = req.get('origin') || req.get('referer') || undefined;
    if (!originAllowed(config.allowedOrigins, origin)) {
      res.status(403).json({ error: 'This form is not permitted on this site.' });
      return;
    }
    await handleSubmit(config, req, res, `Embed: ${hostFromOrigin(origin) || 'external'}`);
  }),
);

/* ── Embed loader ─────────────────────────────────────────────────────────*/

// Injects an <iframe> for the form and auto-resizes it from the iframe's
// postMessage. WEB_ORIGIN is baked in server-side so the snippet is copy-paste.
const EMBED_JS = `(function () {
  var WEB_ORIGIN = ${JSON.stringify(env.CLIENT_ORIGIN)};
  var script = document.currentScript;
  if (!script) return;
  var token = script.getAttribute('data-form-token');
  if (!token) { if (window.console) console.error('[contact-form] missing data-form-token'); return; }
  var iframe = document.createElement('iframe');
  iframe.src = WEB_ORIGIN + '/embed/f/' + encodeURIComponent(token);
  iframe.title = 'Contact form';
  iframe.setAttribute('loading', 'lazy');
  iframe.style.width = '100%';
  iframe.style.border = '0';
  iframe.style.display = 'block';
  iframe.style.minHeight = '520px';
  iframe.style.overflow = 'hidden';
  script.parentNode.insertBefore(iframe, script.nextSibling);
  window.addEventListener('message', function (e) {
    if (e.origin !== WEB_ORIGIN) return;
    var d = e.data;
    if (!d || d.type !== 'rilo-contact-form-height' || d.token !== token) return;
    var h = parseInt(d.height, 10);
    if (h > 0) iframe.style.height = h + 'px';
  });
})();
`;

/** GET /api/public/embed.js — the loader script referenced by the embed snippet. */
contactFormPublicRouter.get('/embed.js', (_req, res) => {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.end(EMBED_JS);
});
