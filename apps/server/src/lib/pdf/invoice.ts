import {
  createDoc, docToBuffer, header, footer, heading, keyValue, table,
  money, niceDate, rule, accentOf, INK, MUTED, PAGE_MARGIN,
} from './base';
import type { CompanySettings } from '@rilo/shared';
import { COMPANY_SETTINGS_DEFAULTS } from '@rilo/shared';

interface InvoiceLike {
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

interface DealLike {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
}

/** Pick a configured value, falling back to the default when blank/missing. */
function val(v: string | undefined, fallback: string): string {
  const t = (v ?? '').trim();
  return t || fallback;
}

/** Build a branded GST tax invoice PDF for a deal. */
export async function buildInvoicePdf(
  invoice: InvoiceLike,
  deal: DealLike,
  settings?: Partial<CompanySettings>,
): Promise<Buffer> {
  const D = COMPANY_SETTINGS_DEFAULTS;
  const doc = createDoc();
  header(doc, val(settings?.invoiceTitle, D.invoiceTitle), settings);

  // Invoice meta + bill-to, two columns.
  const colY = doc.y;
  const colWidth = (doc.page.width - PAGE_MARGIN * 2) / 2;

  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('BILL TO', PAGE_MARGIN, colY);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(deal.clientName || '—');
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(deal.clientEmail || '');
  if (deal.clientPhone) doc.text(deal.clientPhone);

  doc.fillColor(MUTED).font('Helvetica-Bold').fontSize(9).text('INVOICE', PAGE_MARGIN + colWidth, colY, { width: colWidth, align: 'right' });
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(invoice.invoiceNumber || '—', PAGE_MARGIN + colWidth, doc.y, { width: colWidth, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(MUTED)
    .text(`Issued ${niceDate(invoice.createdAt || '')}`, { width: colWidth, align: 'right' })
    .text(`Due ${niceDate(invoice.dueDate)}`, { width: colWidth, align: 'right' })
    .text(`Status: ${invoice.status}`, { width: colWidth, align: 'right' });

  // Reset the cursor to the left margin: the right-aligned INVOICE column above
  // leaves it parked in the right column, which would shift the next section.
  doc.x = PAGE_MARGIN;
  doc.moveDown(2);

  heading(doc, 'Services');
  table(
    doc,
    [
      { header: 'Description', width: 0.6 },
      { header: 'Type', width: 0.18 },
      { header: 'Amount', width: 0.22, align: 'right' },
    ],
    [[val(invoice.description, val(settings?.invoiceDefaultDescription, D.invoiceDefaultDescription)), invoice.type, money(invoice.amount)]],
  );

  // Totals block, right-aligned.
  const totalsX = doc.page.width - PAGE_MARGIN - 220;
  const lineW = 220;
  const totalLine = (label: string, value: string, bold = false) => {
    const font = bold ? 'Helvetica-Bold' : 'Helvetica';
    const size = bold ? 11 : 10;
    const y = doc.y;
    // Label (left) and value (right) share the same baseline; drawing them as
    // two separate full-width runs keeps the value flush-right without the
    // wrapping that `continued: true` + a narrow width causes.
    doc.font(font).fontSize(size).fillColor(bold ? INK : MUTED)
      .text(label, totalsX, y, { width: lineW, align: 'left' });
    doc.font(font).fontSize(size).fillColor(INK)
      .text(value, totalsX, y, { width: lineW, align: 'right' });
  };
  // GST percentage shown on the line is derived from the invoice's own figures
  // (so the label always matches the amounts), falling back to the configured
  // rate when the subtotal is zero.
  const gstPct = invoice.amount > 0
    ? +((invoice.gst / invoice.amount) * 100).toFixed(2)
    : (settings?.gstRate ?? D.gstRate);
  doc.moveDown(0.5);
  totalLine('Subtotal (excl. GST)', money(invoice.amount));
  totalLine(`GST (${gstPct}%)`, money(invoice.gst));
  doc.moveDown(0.2);
  doc.strokeColor(accentOf(doc)).lineWidth(1).moveTo(totalsX, doc.y).lineTo(totalsX + lineW, doc.y).stroke();
  doc.moveDown(0.3);
  totalLine('Total (incl. GST)', money(invoice.total), true);

  // The right-aligned totals leave the text cursor parked in the right column.
  // Reset it to the left margin so the Payment section flows full-width again.
  doc.x = PAGE_MARGIN;
  doc.moveDown(2);
  rule(doc);
  doc.moveDown(0.6);
  heading(doc, 'Payment');
  keyValue(doc, 'Terms', val(settings?.invoicePaymentTerms, D.invoicePaymentTerms));
  const gstNumber = (settings?.gstNumber ?? '').trim();
  if (gstNumber) keyValue(doc, 'GST number', gstNumber);

  const bankDetails = (settings?.bankDetails ?? '').trim();
  if (bankDetails) {
    doc.moveDown(0.3);
    doc.x = PAGE_MARGIN;
    doc.font('Helvetica-Bold').fillColor(MUTED).fontSize(9).text('BANK DETAILS', PAGE_MARGIN, doc.y);
    doc.font('Helvetica').fillColor(INK).fontSize(10)
      .text(bankDetails, PAGE_MARGIN, doc.y, { width: doc.page.width - PAGE_MARGIN * 2 });
  }

  doc.moveDown(0.3);
  doc.x = PAGE_MARGIN;
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(
    val(settings?.invoiceFooterText, D.invoiceFooterText),
    PAGE_MARGIN,
    doc.y,
    { width: doc.page.width - PAGE_MARGIN * 2, align: 'left' },
  );

  footer(doc, settings);
  return docToBuffer(doc);
}
