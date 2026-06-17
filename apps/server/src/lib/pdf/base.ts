import PDFDocument from 'pdfkit';
import type { CompanySettings } from '@rilo/shared';
import { COMPANY_SETTINGS_DEFAULTS } from '@rilo/shared';

/**
 * Shared PDF building blocks for Martelli documents (invoices, DD reports,
 * agency agreements). Pure pdfkit — no headless browser — so it runs anywhere,
 * including Render's free tier.
 */

// Logo azure accent (matches the web Design System v3 --primary). Also the
// default brand colour, so an un-customised document themes identically.
export const ACCENT = '#1e6fb0';
export const INK = '#111827';
export const MUTED = '#6b7280';
export const LINE = '#e5e7eb';

export const PAGE_MARGIN = 50;

export type Doc = PDFKit.PDFDocument;

/** Firm identity + accent resolved for a single document render. */
export interface Branding {
  firmName: string;
  firmAddress: string;
  firmLicence: string;
  accent: string;
  logoDataUrl: string;
}

/**
 * Merge admin-configured company settings over the built-in defaults. Empty or
 * missing fields fall back field-by-field, so an un-customised document renders
 * exactly as before.
 */
export function resolveBranding(settings?: Partial<CompanySettings>): Branding {
  const d = COMPANY_SETTINGS_DEFAULTS;
  return {
    firmName: settings?.firmName?.trim() || d.firmName,
    firmAddress: settings?.firmAddress?.trim() || d.firmAddress,
    firmLicence: settings?.firmLicence?.trim() || d.firmLicence,
    accent: (settings?.brandColor ?? '').trim() || d.brandColor,
    logoDataUrl: settings?.logoDataUrl ?? '',
  };
}

// Per-document accent colour: header() stashes the resolved brand colour on the
// doc so the shared helpers (heading, section rules) theme the whole document
// without every call site threading it through. Falls back to the default ACCENT.
function setAccent(doc: Doc, color: string): void {
  (doc as unknown as { __accent?: string }).__accent = color;
}
export function accentOf(doc: Doc): string {
  return (doc as unknown as { __accent?: string }).__accent || ACCENT;
}

/** Decode a `data:image/(png|jpeg);base64,…` URL to a Buffer, or null if invalid. */
function decodeImageDataUrl(dataUrl: string): Buffer | null {
  const m = /^data:image\/(?:png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  try {
    return Buffer.from(m[1], 'base64');
  } catch {
    return null;
  }
}

/**
 * Verify an image data URL actually decodes and embeds by rendering it into a
 * throwaway document. pdfkit decodes PNG/JPEG **lazily at finalize**, so a
 * corrupt image only throws at `doc.end()` — not at `doc.image()`. This probe is
 * therefore the reliable way to reject a bad image before it's stored, so a
 * broken logo can never crash a real PDF download. Resolves true if it renders.
 */
export function imageRenders(dataUrl: string): Promise<boolean> {
  const buf = decodeImageDataUrl(dataUrl);
  if (!buf) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const probe = new PDFDocument({ size: 'A4' });
      probe.on('error', () => resolve(false));
      probe.on('data', () => { /* drain */ });
      probe.on('end', () => resolve(true));
      probe.image(buf, 0, 0, { fit: [50, 50] });
      probe.end();
    } catch {
      resolve(false);
    }
  });
}

/** Create an A4 document with sensible margins. */
export function createDoc(): Doc {
  return new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true });
}

/** Collect the streamed document into a single Buffer for download/email. */
export function docToBuffer(doc: Doc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

/**
 * Branded letterhead: a logo (or the firm-name wordmark) + address/licence line,
 * with the document label right-aligned, then a rule. Pass company settings to
 * customise identity, accent colour, and logo; omit them for the defaults.
 */
export function header(doc: Doc, docLabel: string, settings?: Partial<CompanySettings>): void {
  const b = resolveBranding(settings);
  setAccent(doc, b.accent);

  // Document label, right-aligned on the first line (same in both paths).
  const drawLabel = () =>
    doc
      .fillColor(INK)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(docLabel.toUpperCase(), PAGE_MARGIN, PAGE_MARGIN + 4, {
        align: 'right',
        width: doc.page.width - PAGE_MARGIN * 2,
      });

  const logo = b.logoDataUrl ? decodeImageDataUrl(b.logoDataUrl) : null;
  if (logo) {
    try {
      doc.image(logo, PAGE_MARGIN, PAGE_MARGIN, { fit: [200, 46] });
      doc
        .fillColor(MUTED)
        .font('Helvetica')
        .fontSize(9)
        .text(`${b.firmAddress}  ·  ${b.firmLicence}`, PAGE_MARGIN, PAGE_MARGIN + 50);
      drawLabel();
      // doc.image() doesn't advance the text cursor, so pin the header bottom
      // deterministically (below logo + address) before the rule.
      doc.y = PAGE_MARGIN + 64;
      doc.moveDown(1);
      rule(doc);
      doc.moveDown(1);
      return;
    } catch {
      /* corrupt image — fall through to the text wordmark */
    }
  }

  // Default path: firm-name wordmark in the accent colour.
  doc.fillColor(b.accent).font('Helvetica-Bold').fontSize(20).text(b.firmName, PAGE_MARGIN, PAGE_MARGIN);
  doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(`${b.firmAddress}  ·  ${b.firmLicence}`);
  drawLabel();
  doc.moveDown(1);
  rule(doc);
  doc.moveDown(1);
}

/** Page footer on every buffered page: firm line + page number. */
export function footer(doc: Doc, settings?: Partial<CompanySettings>): void {
  const b = resolveBranding(settings);
  const firmLine = `${b.firmName}  ·  ${b.firmAddress}  ·  ${b.firmLicence}`;
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    // The footer sits below the bottom margin. Writing text past `page.maxY()`
    // makes pdfkit auto-append a blank page per fragment (which is why the
    // document was ballooning to 3+ pages). Zeroing the bottom margin on the
    // page we're annotating lets the footer render in place without paginating.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - 38;
    doc
      .fillColor(MUTED)
      .font('Helvetica')
      .fontSize(8)
      .text(
        firmLine,
        PAGE_MARGIN,
        y,
        { width: doc.page.width - PAGE_MARGIN * 2, align: 'left', lineBreak: false },
      );
    doc.text(`Page ${i - range.start + 1} of ${range.count}`, PAGE_MARGIN, y, {
      width: doc.page.width - PAGE_MARGIN * 2,
      align: 'right',
      lineBreak: false,
    });
  }
}

/** Full-width horizontal rule at the current y. */
export function rule(doc: Doc, color = LINE): void {
  const y = doc.y;
  doc
    .strokeColor(color)
    .lineWidth(1)
    .moveTo(PAGE_MARGIN, y)
    .lineTo(doc.page.width - PAGE_MARGIN, y)
    .stroke();
}

/** Section heading: accent label above content (uses the document's brand colour). */
export function heading(doc: Doc, text: string): void {
  doc.moveDown(0.6);
  doc.fillColor(accentOf(doc)).font('Helvetica-Bold').fontSize(11).text(text.toUpperCase());
  doc.moveDown(0.3);
  doc.fillColor(INK).font('Helvetica').fontSize(10);
}

/** A "Label: value" line. */
export function keyValue(doc: Doc, label: string, value: string): void {
  doc.font('Helvetica-Bold').fillColor(MUTED).fontSize(9).text(label.toUpperCase(), { continued: true });
  doc.font('Helvetica').fillColor(INK).fontSize(10).text(`   ${value || '—'}`);
}

/** Body paragraph. */
export function paragraph(doc: Doc, text: string): void {
  doc.fillColor(INK).font('Helvetica').fontSize(10).text(text, { align: 'left' });
  doc.moveDown(0.4);
}

export interface TableColumn {
  header: string;
  width: number; // fraction of available width (0..1)
  align?: 'left' | 'right' | 'center';
}

/**
 * Render a simple bordered table. Columns widths are fractions of the content
 * width and should sum to ~1. Rows wrap to new pages automatically.
 */
export function table(doc: Doc, columns: TableColumn[], rows: string[][]): void {
  const contentWidth = doc.page.width - PAGE_MARGIN * 2;
  const widths = columns.map((c) => c.width * contentWidth);
  const padding = 6;
  const rowHeight = 22;

  const drawRow = (cells: string[], y: number, isHeader: boolean) => {
    let x = PAGE_MARGIN;
    if (isHeader) {
      doc.rect(PAGE_MARGIN, y, contentWidth, rowHeight).fill('#f3f4f6');
    }
    columns.forEach((col, i) => {
      doc
        .fillColor(isHeader ? MUTED : INK)
        .font(isHeader ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(isHeader ? 8 : 9)
        .text(cells[i] ?? '', x + padding, y + padding, {
          width: widths[i] - padding * 2,
          align: col.align ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
      x += widths[i];
    });
    doc.strokeColor(LINE).lineWidth(0.5).moveTo(PAGE_MARGIN, y + rowHeight).lineTo(PAGE_MARGIN + contentWidth, y + rowHeight).stroke();
  };

  let y = doc.y;
  drawRow(columns.map((c) => c.header), y, true);
  y += rowHeight;

  for (const row of rows) {
    if (y + rowHeight > doc.page.height - 60) {
      doc.addPage();
      y = doc.y;
      drawRow(columns.map((c) => c.header), y, true);
      y += rowHeight;
    }
    drawRow(row, y, false);
    y += rowHeight;
  }
  doc.y = y;
  doc.moveDown(0.5);
}

/** NZ money formatting. */
export function money(n: number): string {
  return `$${(n || 0).toLocaleString('en-NZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Friendly date (falls back to the raw string if unparseable). */
export function niceDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' });
}
