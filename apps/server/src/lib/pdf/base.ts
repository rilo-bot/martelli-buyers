import PDFDocument from 'pdfkit';

/**
 * Shared PDF building blocks for Martelli documents (invoices, DD reports,
 * agency agreements). Pure pdfkit — no headless browser — so it runs anywhere,
 * including Render's free tier.
 */

// Logo azure accent (matches the web Design System v3 --primary).
export const ACCENT = '#1e6fb0';
export const INK = '#111827';
export const MUTED = '#6b7280';
export const LINE = '#e5e7eb';

export const PAGE_MARGIN = 50;

const FIRM = {
  name: 'Martelli Buyers Agents',
  address: '1B George Street, Parnell, Auckland',
  licence: 'Licensed REAA 2008',
};

export type Doc = PDFKit.PDFDocument;

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

/** Branded letterhead: firm name in accent + address/licence line + a rule. */
export function header(doc: Doc, docLabel: string): void {
  doc
    .fillColor(ACCENT)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text(FIRM.name, PAGE_MARGIN, PAGE_MARGIN);
  doc
    .fillColor(MUTED)
    .font('Helvetica')
    .fontSize(9)
    .text(`${FIRM.address}  ·  ${FIRM.licence}`);

  // Document label, right-aligned on the first line.
  doc
    .fillColor(INK)
    .font('Helvetica-Bold')
    .fontSize(13)
    .text(docLabel.toUpperCase(), PAGE_MARGIN, PAGE_MARGIN + 4, {
      align: 'right',
      width: doc.page.width - PAGE_MARGIN * 2,
    });

  doc.moveDown(1);
  rule(doc);
  doc.moveDown(1);
}

/** Page footer on every buffered page: firm line + page number. */
export function footer(doc: Doc): void {
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
        `${FIRM.name}  ·  ${FIRM.address}  ·  ${FIRM.licence}`,
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

/** Section heading: accent label above content. */
export function heading(doc: Doc, text: string): void {
  doc.moveDown(0.6);
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(11).text(text.toUpperCase());
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
