import {
  createDoc, docToBuffer, header, footer, heading, keyValue, paragraph,
  money, niceDate, rule, INK, MUTED, ACCENT, PAGE_MARGIN,
} from './base';

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
  agreementSignerName?: string;
  agreementSignedAt?: string;
}

function feeText(deal: DealLike): string {
  return deal.feeType === 'percentage'
    ? `${deal.fee}% of the purchase price, plus GST`
    : `${money(deal.fee)}, plus GST`;
}

/**
 * Build the Buyer's Agency Agreement. When `signed` is true a signature block
 * is stamped with the signer's name and timestamp; otherwise it shows the
 * pending e-signature instructions.
 */
export async function buildAgreementPdf(deal: DealLike, opts: { signed: boolean }): Promise<Buffer> {
  const doc = createDoc();
  header(doc, 'Buyer’s Agency Agreement');

  heading(doc, 'Parties');
  keyValue(doc, 'Buyer', deal.clientName);
  keyValue(doc, 'Email', deal.clientEmail);
  if (deal.clientPhone) keyValue(doc, 'Phone', deal.clientPhone);
  keyValue(doc, 'Agent', 'Martelli Buyers Agents (Licensed REAA 2008)');

  heading(doc, 'Buyer Requirements');
  keyValue(doc, 'Property type', deal.propertyType || 'As discussed');
  keyValue(doc, 'Configuration', `${deal.bedrooms} bed / ${deal.bathrooms} bath`);
  keyValue(doc, 'Budget', money(deal.budget));
  keyValue(doc, 'Preferred suburbs', deal.preferredSuburbs.join(', ') || 'As discussed');
  if (deal.brief) {
    doc.moveDown(0.3);
    paragraph(doc, deal.brief);
  }

  heading(doc, 'Fee for Service');
  paragraph(doc, `The buyer agrees to engage Martelli Buyers Agents to search for and negotiate the purchase of a property meeting the requirements above. The fee for this service is ${feeText(deal)}.`);

  heading(doc, 'Terms');
  paragraph(doc, 'This agreement is governed by the Real Estate Agents Act 2008. The buyer acknowledges receipt of the REA Approved Guide to buyer agency agreements and confirms they have been advised they may seek independent legal advice before signing. The agency will act in the buyer’s best interests at all times.');

  doc.moveDown(1);
  rule(doc, ACCENT);
  doc.moveDown(0.8);

  heading(doc, 'Signature');
  if (opts.signed && deal.agreementSignerName) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(ACCENT).text(deal.agreementSignerName);
    doc.font('Helvetica').fontSize(9).fillColor(MUTED)
      .text(`Signed electronically on ${niceDate(deal.agreementSignedAt || '')}`)
      .text('Accepted via Martelli Buyers secure e-signature.');
  } else {
    doc.font('Helvetica').fontSize(10).fillColor(INK).text('Signature: ___________________________________');
    doc.moveDown(0.6);
    doc.text('Full name: ____________________________________');
    doc.moveDown(0.6);
    doc.text('Date: _________________________________________');
    doc.moveDown(0.6);
    doc.font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(
      'To sign electronically, use the secure link emailed to you by Martelli Buyers Agents.',
      PAGE_MARGIN,
      doc.y,
    );
  }

  footer(doc);
  return docToBuffer(doc);
}
