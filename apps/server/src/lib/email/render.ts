import sanitizeHtml from 'sanitize-html';
import juice from 'juice';
import type { CompanySettings } from '@rilo/shared';
import { COMPANY_SETTINGS_DEFAULTS } from '@rilo/shared';

/**
 * Turns author-supplied rich HTML (from the WYSIWYG editor) into a finished,
 * email-client-safe message: sanitised body wrapped in a branded shell (logo
 * header, brand-colour accents, signature footer) with all CSS inlined so
 * Outlook/Gmail render it consistently. This is the single source of truth for
 * outbound HTML — the editor is only an authoring surface and its output is
 * never trusted directly.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

// Colour values we accept in inline `style` attributes (hex, rgb(), or a CSS
// colour keyword). Kept deliberately narrow.
const COLOUR = [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(/i, /^rgba\(/i, /^[a-zA-Z]+$/];

const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'span', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'hr', 'img',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    '*': ['style'],
  },
  // Drop links with unsafe schemes (javascript:, data:, …).
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // Email clients block/strip base64 and mixed-content images — require https.
  allowedSchemesByTag: { img: ['https'] },
  allowedStyles: {
    '*': {
      color: COLOUR,
      'background-color': COLOUR,
      'text-align': [/^(left|right|center|justify)$/],
      'text-decoration': [/^(underline|line-through|none)$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/],
    },
  },
  // Force every link to open in a new tab and not leak the referrer.
  transformTags: {
    a: (_tag, attribs) => ({
      tagName: 'a',
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};

/** Sanitise rich HTML for safe use in an email body or signature. */
export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html ?? '', SANITIZE_OPTS);
}

/** Plain-text fallback (the `text` part of the email) derived from HTML. */
export function htmlToText(html: string): string {
  const withBreaks = (html ?? '')
    .replace(/<\/(p|div|h[1-3]|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n');
  const text = sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Escape a plain string for safe interpolation into our own HTML attributes/text. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Convert a plain-text body to simple HTML (mirrors the legacy mailer behaviour). */
export function plainTextToHtml(text: string): string {
  return `<div>${esc(text).replace(/\n/g, '<br>')}</div>`;
}

interface RenderOpts {
  /** The message body as HTML (already interpolated; will be sanitised here). */
  bodyHtml: string;
  /** Draft or saved company settings; missing fields fall back to defaults. */
  settings?: Partial<CompanySettings>;
}

/**
 * Wrap a body in the branded, email-safe shell and inline all CSS. When
 * `emailBrandingEnabled` is false, returns the sanitised body in a minimal,
 * unbranded wrapper instead.
 */
export function renderBrandedEmail({ bodyHtml, settings }: RenderOpts): string {
  const s = { ...COMPANY_SETTINGS_DEFAULTS, ...(settings ?? {}) } as CompanySettings;
  const safeBody = sanitizeEmailHtml(bodyHtml);

  if (s.emailBrandingEnabled === false) {
    return juice(minimalShell(safeBody));
  }

  const brand = HEX.test(s.brandColor) ? s.brandColor : COMPANY_SETTINGS_DEFAULTS.brandColor;
  const firmName = s.firmName || COMPANY_SETTINGS_DEFAULTS.firmName;

  const header = s.emailLogoUrl
    ? `<img src="${esc(s.emailLogoUrl)}" alt="${esc(firmName)}" style="max-height:44px;max-width:220px;display:block;border:0" />`
    : `<span style="font-size:20px;font-weight:700;color:#ffffff;font-family:Inter,system-ui,Arial,sans-serif">${esc(firmName)}</span>`;

  const signature = s.emailSignatureHtml ? sanitizeEmailHtml(s.emailSignatureHtml) : '';
  const signatureBlock = signature
    ? `<tr><td style="padding:4px 32px 0">
         <div style="border-top:1px solid #eaeaea;margin:8px 0 0"></div>
         <div class="email-sig" style="padding:16px 0 0">${signature}</div>
       </td></tr>`
    : '';

  const addressLine = s.firmAddress ? `<br>${esc(s.firmAddress)}` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>${bodyStyles(brand)}</style>
</head>
<body style="margin:0;padding:0;background:#f4f5f7">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:24px 0">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #eaeaea">
        <tr><td style="background:${brand};padding:20px 32px">${header}</td></tr>
        <tr><td class="email-body" style="padding:28px 32px 8px">${safeBody}</td></tr>
        ${signatureBlock}
        <tr><td style="padding:24px 32px 28px">
          <div style="border-top:1px solid #eaeaea;margin:0 0 14px"></div>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#9098a3;font-family:Inter,system-ui,Arial,sans-serif">
            ${esc(firmName)}${addressLine}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return juice(html);
}

/** Minimal unbranded wrapper used when branding is switched off. */
function minimalShell(safeBody: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><style>${bodyStyles('#1e6fb0')}</style></head>
<body style="margin:0;padding:0"><div class="email-body" style="font-family:Inter,system-ui,Arial,sans-serif;color:#222;padding:16px">${safeBody}</div></body></html>`;
}

/**
 * Element typography for body content. juice() inlines these onto the sanitised
 * body's tags (which carry no inline styles of their own), giving Outlook/Gmail
 * consistent rendering. The brand colour drives links and blockquote accents.
 */
function bodyStyles(brand: string): string {
  return `
    .email-body p { margin:0 0 14px; font-size:15px; line-height:1.6; color:#222222; font-family:Inter,system-ui,Arial,sans-serif; }
    .email-body h1 { margin:0 0 12px; font-size:22px; line-height:1.3; color:#111111; font-family:Inter,system-ui,Arial,sans-serif; }
    .email-body h2 { margin:0 0 10px; font-size:18px; line-height:1.35; color:#111111; font-family:Inter,system-ui,Arial,sans-serif; }
    .email-body h3 { margin:0 0 8px; font-size:16px; line-height:1.4; color:#111111; font-family:Inter,system-ui,Arial,sans-serif; }
    .email-body a { color:${brand}; text-decoration:underline; }
    .email-body ul, .email-body ol { margin:0 0 14px 22px; padding:0; }
    .email-body li { margin:0 0 6px; font-size:15px; line-height:1.6; color:#222222; font-family:Inter,system-ui,Arial,sans-serif; }
    .email-body img { max-width:100%; height:auto; border:0; }
    .email-body blockquote { margin:0 0 14px; padding:8px 16px; border-left:3px solid ${brand}; color:#555555; }
    .email-body hr { border:0; border-top:1px solid #eaeaea; margin:18px 0; }
    .email-sig p { margin:0 0 4px; font-size:13px; line-height:1.5; color:#555555; font-family:Inter,system-ui,Arial,sans-serif; }
    .email-sig a { color:${brand}; }
    .email-sig img { max-width:100%; height:auto; border:0; }
  `;
}
