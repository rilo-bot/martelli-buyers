import sanitizeHtml from 'sanitize-html';
import type { CompanySettings } from '@rilo/shared';
import { AGREEMENT_MERGE_FIELDS } from '@rilo/shared';
import { buildAgreementPdf, defaultFeeText, DEFAULT_TERMS } from './agreement';
import { resolveBranding, money, niceDate, type Branding } from './base';
import { renderHtmlToPdf } from './htmlToPdf';

/**
 * HTML→PDF agreement builder. The whole agreement is one rich-HTML document
 * authored in the WYSIWYG editor and stored on `deal.agreementBodyHtml`. At
 * build time we: resolve inline merge-field chips against the deal/firm →
 * sanitise → wrap in a branded print shell → append the system-managed signature
 * section → render with headless Chromium so the PDF matches the editor exactly.
 *
 * The editor is only an authoring surface; its HTML is never trusted directly.
 */

interface DealLike {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  brief: string;
  budget: number;
  fee: number;
  feeType: string;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  preferredSuburbs: string[];
  agreementClauses?: string;
  agreementBodyHtml?: string;
  agreementSignerName?: string;
  agreementSignedAt?: string;
  agreementSignatureImage?: string;
}

/** Escape a string for safe interpolation into HTML text/attributes. */
function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const LABEL_BY_TOKEN: Record<string, string> = Object.fromEntries(
  AGREEMENT_MERGE_FIELDS.map((f) => [f.token, f.label]),
);

/** Build the token→value map resolved into the agreement at PDF build. */
function dealVariables(deal: DealLike, brand: Branding): Record<string, string> {
  const suburbs = (deal.preferredSuburbs || []).filter(Boolean).join(', ');
  return {
    clientName: deal.clientName || '',
    clientEmail: deal.clientEmail || '',
    clientPhone: deal.clientPhone || '',
    budget: deal.budget > 0 ? money(deal.budget) : '',
    propertyType: deal.propertyType || '',
    bedrooms: deal.bedrooms ? String(deal.bedrooms) : '',
    bathrooms: deal.bathrooms ? String(deal.bathrooms) : '',
    suburbs,
    requirements: deal.brief || '',
    firmName: brand.firmName,
    firmLicence: brand.firmLicence,
    date: niceDate(new Date().toISOString()),
  };
}

const CHIP_RE = /<span\b[^>]*\bdata-merge-field=["']([\w]+)["'][^>]*>.*?<\/span>/gi;
const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Replace merge-field chips (`<span data-merge-field="…">`) and literal
 * `{{token}}` with their resolved, escaped values. Unresolved/empty tokens
 * render as a visible `[Label]` placeholder so staff notice missing data before
 * sending. Runs BEFORE sanitisation, so no merge markup reaches the renderer.
 */
function resolveMergeFields(html: string, vars: Record<string, string>): string {
  const resolve = (token: string): string => {
    const v = vars[token];
    if (v && v.trim()) return esc(v);
    return `[${esc(LABEL_BY_TOKEN[token] ?? token)}]`;
  };
  return html.replace(CHIP_RE, (_m, t: string) => resolve(t)).replace(TOKEN_RE, (_m, t: string) => resolve(t));
}

// Font families the editor offers; anything else in a style is dropped.
const FONT_FAMILY = [/^[\w\s,'"-]+$/];
const COLOUR = [/^#(0x)?[0-9a-fA-F]{3,8}$/, /^rgb\(/i, /^rgba\(/i, /^[a-zA-Z]+$/];

const SANITIZE_AGREEMENT_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'span', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
    'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'blockquote', 'hr', 'img',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height', 'style'],
    '*': ['style', 'class'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // Body images are S3-hosted (the editor uploads, never inlines base64).
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowedStyles: {
    '*': {
      color: COLOUR,
      'background-color': COLOUR,
      'font-family': FONT_FAMILY,
      'font-size': [/^\d{1,3}px$/],
      'font-weight': [/^(normal|bold|[1-9]00)$/],
      'font-style': [/^(normal|italic)$/],
      'text-align': [/^(left|right|center|justify)$/],
      'text-decoration': [/^(underline|line-through|none)$/],
    },
  },
  transformTags: {
    a: (_tag, attribs) => ({
      tagName: 'a',
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};

const SIG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

// Matches the (sanitised) signature placeholder dropped in by the editor.
const SIGNATURE_PLACEHOLDER = /<div[^>]*\bclass="[^"]*\bsignature-block\b[^"]*"[^>]*>\s*<\/div>/i;

/**
 * Put the signature section where the author placed it (the `signature-block`
 * marker); if there's no marker, append it at the end (back-compat). Runs after
 * sanitisation because the section may embed the signature image data-URL.
 */
function injectSignature(safeHtml: string, section: string): string {
  if (SIGNATURE_PLACEHOLDER.test(safeHtml)) return safeHtml.replace(SIGNATURE_PLACEHOLDER, section);
  return safeHtml + section;
}

/** The system-managed signature section (pending blanks or the signed block). */
function signatureSection(deal: DealLike, signed: boolean, brand: Branding): string {
  if (signed && deal.agreementSignerName) {
    const img = deal.agreementSignatureImage && SIG_DATA_URL.test(deal.agreementSignatureImage)
      ? `<img class="sig-img" src="${esc(deal.agreementSignatureImage)}" alt="Signature" />`
      : '';
    return `<section class="signature">
      <h2>Signature</h2>
      ${img}
      <div class="sig-line"></div>
      <p class="signer-name">${esc(deal.agreementSignerName)}</p>
      <p class="muted-note">Signed electronically on ${esc(niceDate(deal.agreementSignedAt || ''))}</p>
      <p class="muted-note">Accepted via ${esc(brand.firmName)} secure e-signature.</p>
    </section>`;
  }
  return `<section class="signature">
    <h2>Signature</h2>
    <p class="sig-blank">Signature: ___________________________________</p>
    <p class="sig-blank">Full name: ____________________________________</p>
    <p class="sig-blank">Date: _________________________________________</p>
    <p class="muted-note">To sign electronically, use the secure link emailed to you by ${esc(brand.firmName)}.</p>
  </section>`;
}

/** Print stylesheet — mirrors the email shell's typography for a consistent look. */
function printStyles(accent: string): string {
  return `
    @page { size: A4; }
    * { box-sizing: border-box; }
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .agreement { font-family: 'Inter', system-ui, Arial, sans-serif; color: #111827; font-size: 11pt; line-height: 1.6; }
    .letterhead { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; border-bottom: 2px solid ${accent}; padding-bottom: 12px; margin-bottom: 22px; }
    .letterhead .logo { max-height: 52px; max-width: 220px; }
    .letterhead .firm { font-size: 20px; font-weight: 700; color: ${accent}; }
    .letterhead .meta { font-size: 9px; color: #6b7280; margin-top: 4px; }
    .letterhead .doc-label { font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #111827; text-align: right; white-space: nowrap; }
    .agreement-body h1 { font-size: 19px; margin: 18px 0 10px; }
    .agreement-body h2 { font-size: 15px; margin: 18px 0 8px; color: ${accent}; text-transform: uppercase; letter-spacing: .03em; }
    .agreement-body h3 { font-size: 13px; margin: 14px 0 6px; }
    .agreement-body p { margin: 0 0 10px; }
    .agreement-body ul, .agreement-body ol { margin: 0 0 12px 22px; padding: 0; }
    .agreement-body li { margin: 0 0 5px; }
    .agreement-body a { color: ${accent}; text-decoration: underline; }
    .agreement-body img { max-width: 100%; height: auto; }
    .agreement-body blockquote { margin: 0 0 12px; padding: 6px 14px; border-left: 3px solid ${accent}; color: #555; }
    .agreement-body hr { border: 0; border-top: 1px solid #e5e7eb; margin: 16px 0; }
    .agreement-body table { width: 100%; border-collapse: collapse; margin: 0 0 12px; }
    .agreement-body td, .agreement-body th { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
    .page-break { break-after: page; page-break-after: always; height: 0; }
    .logo-box { width: 120px; height: 120px; display: inline-flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 8px; }
    .logo-box img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .doc-footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #e5e7eb; font-size: 9pt; color: #6b7280; }
    .signature { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e5e7eb; }
    .signature h2 { font-size: 15px; color: ${accent}; text-transform: uppercase; letter-spacing: .03em; margin: 0 0 12px; }
    .signature .sig-img { max-height: 70px; max-width: 220px; display: block; }
    .signature .sig-line { width: 220px; border-bottom: 1px solid #6b7280; margin: 4px 0 8px; }
    .signature .signer-name { font-size: 13px; font-weight: 700; color: ${accent}; margin: 0 0 4px; }
    .signature .sig-blank { margin: 0 0 14px; }
    .signature .muted-note { font-size: 9px; color: #6b7280; margin: 2px 0 0; }
    /* Author-embedded signature (drawn or typed) inside a signature-block. */
    .agreement-body .signature-block { margin: 16px 0; }
    .agreement-body .sig-img { max-height: 80px; max-width: 260px; display: block; }
    .agreement-body .sig-line { width: 260px; border-bottom: 1px solid #6b7280; margin: 4px 0 6px; }
    .agreement-body .sig-name { font-size: 12px; color: #374151; }
    .agreement-body .sig-typed { font-family: 'Dancing Script', 'Segoe Script', 'Brush Script MT', cursive; font-size: 26px; color: #111827; }
  `;
}

/** Branded letterhead for the first page (logo or firm wordmark + meta + doc label). */
function letterhead(brand: Branding, docLabel: string): string {
  const left = SIG_DATA_URL.test(brand.logoDataUrl) || /^data:image\/(png|jpe?g);base64,/.test(brand.logoDataUrl)
    ? `<img class="logo" src="${esc(brand.logoDataUrl)}" alt="${esc(brand.firmName)}" />`
    : `<div class="firm">${esc(brand.firmName)}</div>`;
  return `<header class="letterhead">
    <div>
      ${left}
      <div class="meta">${esc(brand.firmAddress)} &nbsp;·&nbsp; ${esc(brand.firmLicence)}</div>
    </div>
    <div class="doc-label">${esc(docLabel)}</div>
  </header>`;
}

const DOC_LABEL = 'Buyer’s Agency Agreement';

/** Wrap the sanitised body in the full print document. The built-in letterhead
 *  is shown only when the author hasn't supplied their own header (logo box). */
function wrapPrintShell(bodyHtml: string, brand: Branding, showLetterhead: boolean): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Dancing+Script:wght@500;600;700&display=swap" rel="stylesheet" />
<style>${printStyles(brand.accent)}</style>
</head>
<body>
  <div class="agreement">
    ${showLetterhead ? letterhead(brand, DOC_LABEL) : ''}
    <div class="agreement-body">${bodyHtml}</div>
  </div>
</body>
</html>`;
}

/** Chromium running header/footer (text only — reliable across versions). */
function headerFooterTemplates(brand: Branding): { headerTemplate: string; footerTemplate: string } {
  const muted = 'font-size:8px;color:#9098a3;font-family:Inter,Arial,sans-serif;width:100%;padding:0 48px;';
  return {
    headerTemplate: `<div style="${muted}">
      <span style="float:left;">${esc(brand.firmName)}</span>
      <span style="float:right;">${esc(DOC_LABEL)}</span>
    </div>`,
    footerTemplate: `<div style="${muted}">
      <span style="float:left;">${esc(brand.firmName)} · ${esc(brand.firmAddress)} · ${esc(brand.firmLicence)}</span>
      <span style="float:right;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
    </div>`,
  };
}

/**
 * Build the agreement PDF from the rich-HTML body. Throws if Chromium fails —
 * callers may fall back to the pdfkit builder so a download never hard-fails.
 */
export async function buildAgreementHtmlPdf(
  deal: DealLike,
  opts: { signed: boolean },
  settings?: Partial<CompanySettings>,
): Promise<Buffer> {
  const brand = resolveBranding(settings);
  const vars = dealVariables(deal, brand);
  const resolved = resolveMergeFields(deal.agreementBodyHtml || '', vars);
  let safeBody = sanitizeHtml(resolved, SANITIZE_AGREEMENT_OPTS);
  // Swap the signature placeholder for the real section (after sanitise: it may
  // embed the signature image data-URL).
  safeBody = injectSignature(safeBody, signatureSection(deal, opts.signed, brand));
  // If the author built their own header (a logo box), skip the built-in one.
  const showLetterhead = !/\bclass="[^"]*\blogo-box\b/.test(safeBody);
  const html = wrapPrintShell(safeBody, brand, showLetterhead);
  const { footerTemplate } = headerFooterTemplates(brand);
  return renderHtmlToPdf(html, {
    footerTemplate,
    margin: { top: '54px', bottom: '60px', left: '48px', right: '48px' },
  });
}

/**
 * Render the agreement PDF for a deal, choosing the renderer: the rich-HTML
 * (Chromium) path once the deal has an `agreementBodyHtml`, else the legacy
 * pdfkit builder. If Chromium rendering fails, fall back to pdfkit so a
 * download/email/sign flow never hard-fails.
 */
export async function renderAgreementPdf(
  deal: DealLike,
  opts: { signed: boolean },
  settings?: Partial<CompanySettings>,
): Promise<Buffer> {
  if (deal.agreementBodyHtml) {
    try {
      return await buildAgreementHtmlPdf(deal, opts, settings);
    } catch (err) {
      console.warn('[agreement] HTML→PDF render failed, falling back to pdfkit —', (err as Error).message);
    }
  }
  return buildAgreementPdf(deal as never, opts, settings);
}

/**
 * Editable header: a logo box (prefilled from the hosted email logo if any — it
 * must be https for the editor + PDF; base64 logos aren't carried over) and the
 * firm identity. The author can replace the logo by clicking the box.
 */
function headerHtml(brand: Branding, settings?: Partial<CompanySettings>): string {
  const logoUrl = (settings?.emailLogoUrl || '').trim();
  const logoBox = /^https:\/\//i.test(logoUrl)
    ? `<div class="logo-box"><img src="${esc(logoUrl)}" alt="Logo"></div>`
    : '<div class="logo-box"></div>';
  return [
    logoBox,
    `<h1>${esc(brand.firmName)}</h1>`,
    `<p>${esc(brand.firmAddress)} &nbsp;·&nbsp; ${esc(brand.firmLicence)}</p>`,
    '<hr>',
  ].join('\n');
}

/** Empty signature placeholder + editable footer notes (appended to the body). */
const SIGNATURE_BLOCK = '<div class="signature-block"></div>';
const FOOTER_HTML = '<hr>\n<p>Add footer notes here — payment details, disclaimers or contact information.</p>';

/** The core agreement sections (Parties / Requirements / Fee / Terms / clauses). */
function coreSections(deal: DealLike): string {
  const chip = (token: string) => {
    const label = LABEL_BY_TOKEN[token] ?? token;
    return `<span data-merge-field="${token}" class="merge-chip">${esc(label)}</span>`;
  };
  const feeDefault = defaultFeeText({ feeType: deal.feeType, fee: deal.fee, budget: deal.budget } as never);
  const clauses = (deal.agreementClauses || '')
    .split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

  return [
    '<h2>Parties</h2>',
    `<p><strong>Buyer:</strong> ${chip('clientName')}</p>`,
    `<p><strong>Email:</strong> ${chip('clientEmail')}</p>`,
    `<p><strong>Agent:</strong> ${chip('firmName')} (${chip('firmLicence')})</p>`,
    '<h2>Buyer Requirements</h2>',
    `<p><strong>Property type:</strong> ${chip('propertyType')}</p>`,
    `<p><strong>Configuration:</strong> ${chip('bedrooms')} bed / ${chip('bathrooms')} bath</p>`,
    `<p><strong>Budget:</strong> ${chip('budget')}</p>`,
    `<p><strong>Preferred suburbs:</strong> ${chip('suburbs')}</p>`,
    deal.brief ? `<p>${esc(deal.brief)}</p>` : '',
    '<h2>Fee for Service</h2>',
    `<p>${esc(feeDefault)}</p>`,
    '<h2>Terms</h2>',
    `<p>${esc(DEFAULT_TERMS)}</p>`,
    clauses ? `<h2>Additional Terms</h2>${clauses}` : '',
  ].filter(Boolean).join('\n');
}

/**
 * Build the initial rich-HTML body for a deal that has none yet: header (logo +
 * firm) → core sections → signature placeholder → footer. Identity/requirements
 * use merge-field chips so they stay in sync until edited.
 */
export function seedAgreementHtml(deal: DealLike, settings?: Partial<CompanySettings>): string {
  const brand = resolveBranding(settings);
  return [headerHtml(brand, settings), coreSections(deal), SIGNATURE_BLOCK, FOOTER_HTML].join('\n');
}

/**
 * Non-destructively add any missing scaffold (header, signature block, footer) to
 * an already-seeded body — so agreements created before these were introduced
 * gain them without losing the author's content. Returns the (possibly) updated
 * HTML and whether it changed.
 */
export function ensureAgreementScaffold(
  body: string,
  settings?: Partial<CompanySettings>,
): { html: string; changed: boolean } {
  const brand = resolveBranding(settings);
  let html = body;
  let changed = false;
  if (!/class="[^"]*\blogo-box\b/.test(html)) {
    html = `${headerHtml(brand, settings)}\n${html}`;
    changed = true;
  }
  if (!/class="[^"]*\bsignature-block\b/.test(html)) {
    html = `${html}\n${SIGNATURE_BLOCK}\n${FOOTER_HTML}`;
    changed = true;
  }
  return { html, changed };
}
