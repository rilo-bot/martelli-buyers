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
  agreementSignatureImage?: string;
  agreementFeeText?: string;
  agreementTermsText?: string;
  agreementClauses?: string;
}

/** Default "Fee for Service" paragraph, derived from the deal's fee. */
export function defaultFeeText(deal: DealLike): string {
  return `The buyer agrees to engage Martelli Buyers Agents to search for and negotiate the purchase of a property meeting the requirements above. The fee for this service is ${feeText(deal)}.`;
}

/** Default "Terms" paragraph (static REAA boilerplate). */
export const DEFAULT_TERMS =
  'This agreement is governed by the Real Estate Agents Act 2008. The buyer acknowledges receipt of the REA Approved Guide to buyer agency agreements and confirms they have been advised they may seek independent legal advice before signing. The agency will act in the buyer’s best interests at all times.';

/** Decode a 'data:image/png;base64,...' URL into a Buffer, or null if invalid. */
function decodePngDataUrl(dataUrl?: string): Buffer | null {
  if (!dataUrl) return null;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    return Buffer.from(match[1], 'base64');
  } catch {
    return null;
  }
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
  paragraph(doc, deal.agreementFeeText?.trim() || defaultFeeText(deal));

  heading(doc, 'Terms');
  paragraph(doc, deal.agreementTermsText?.trim() || DEFAULT_TERMS);

  // Optional admin-authored extra clauses. Blank lines separate paragraphs.
  if (deal.agreementClauses?.trim()) {
    heading(doc, 'Additional Terms');
    for (const para of deal.agreementClauses.split(/\n{2,}/)) {
      if (para.trim()) paragraph(doc, para.trim());
    }
  }

  doc.moveDown(1);
  rule(doc, ACCENT);
  doc.moveDown(0.8);

  heading(doc, 'Signature');
  if (opts.signed && deal.agreementSignerName) {
    // If the buyer drew a signature, stamp the image above the typed name;
    // otherwise the typed name itself stands as the signature.
    const sig = decodePngDataUrl(deal.agreementSignatureImage);
    if (sig) {
      try {
        doc.image(sig, PAGE_MARGIN, doc.y, { fit: [220, 70] });
        doc.moveDown(0.3);
        doc.y += 70;
        doc.strokeColor(MUTED).lineWidth(0.5)
          .moveTo(PAGE_MARGIN, doc.y).lineTo(PAGE_MARGIN + 220, doc.y).stroke();
        doc.moveDown(0.4);
      } catch {
        /* corrupt image — fall through to the name-only block below */
      }
    }
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
