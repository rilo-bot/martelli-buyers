import {
  createDoc, docToBuffer, header, footer, heading, keyValue, table,
  money, niceDate, paragraph, INK, MUTED,
} from './base';
import type { CompanySettings } from '@rilo/shared';

interface ChecklistItem { label: string; status: string }
interface Comparable {
  address: string; suburb: string; salePrice: number; saleDate: string;
  bedrooms: number; bathrooms: number; landSize: number;
}
interface Evidence { label: string; url: string; type: string }

interface DDLike {
  address: string;
  floodMapUrl: string;
  floodMapNotes: string;
  naturalHazardsUrl: string;
  naturalHazardsNotes: string;
  councilRecordsUrl: string;
  evidenceLinks: Evidence[];
  comparableSales: Comparable[];
  checklistItems: ChecklistItem[];
  updatedAt?: string;
}

const STATUS_LABEL: Record<string, string> = {
  completed: 'Complete',
  pending: 'Pending',
  na: 'N/A',
};

/**
 * Build the buyer-facing Due Diligence report. Internal notes are intentionally
 * excluded — the UI marks them staff-only.
 */
export async function buildDdReportPdf(record: DDLike, settings?: Partial<CompanySettings>): Promise<Buffer> {
  const doc = createDoc();
  header(doc, 'Due Diligence Report', settings);

  heading(doc, 'Property');
  keyValue(doc, 'Address', record.address);
  keyValue(doc, 'Report date', niceDate(record.updatedAt || ''));

  // Checklist summary
  const done = record.checklistItems.filter((i) => i.status === 'completed').length;
  heading(doc, `Audit Checklist (${done}/${record.checklistItems.length})`);
  if (record.checklistItems.length) {
    table(
      doc,
      [
        { header: 'Item', width: 0.78 },
        { header: 'Status', width: 0.22, align: 'right' },
      ],
      record.checklistItems.map((i) => [i.label, STATUS_LABEL[i.status] ?? i.status]),
    );
  } else {
    paragraph(doc, 'No checklist items recorded.');
  }

  // Comparable sales
  heading(doc, `Comparable Sales (${record.comparableSales.length})`);
  if (record.comparableSales.length) {
    table(
      doc,
      [
        { header: 'Address', width: 0.34 },
        { header: 'Suburb', width: 0.2 },
        { header: 'Sale Price', width: 0.18, align: 'right' },
        { header: 'Date', width: 0.16 },
        { header: 'Bd/Ba', width: 0.12, align: 'right' },
      ],
      record.comparableSales.map((c) => [
        c.address, c.suburb, money(c.salePrice), niceDate(c.saleDate), `${c.bedrooms}/${c.bathrooms}`,
      ]),
    );
  } else {
    paragraph(doc, 'No comparable sales recorded.');
  }

  // Hazards
  heading(doc, 'Hazard & Council Checks');
  keyValue(doc, 'Flood map', record.floodMapUrl || 'Not supplied');
  if (record.floodMapNotes) paragraph(doc, record.floodMapNotes);
  keyValue(doc, 'Natural hazards (NHRP)', record.naturalHazardsUrl || 'Not supplied');
  if (record.naturalHazardsNotes) paragraph(doc, record.naturalHazardsNotes);
  keyValue(doc, 'Council records', record.councilRecordsUrl || 'Not supplied');

  // Evidence
  heading(doc, `Evidence (${record.evidenceLinks.length})`);
  if (record.evidenceLinks.length) {
    record.evidenceLinks.forEach((e) => {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(INK).text(`• ${e.label}`, { continued: true });
      doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(`  (${e.type}) — ${e.url}`);
    });
  } else {
    paragraph(doc, 'No evidence attached.');
  }

  doc.moveDown(1);
  doc.font('Helvetica-Oblique').fontSize(8).fillColor(MUTED).text(
    'This report is prepared by Martelli Buyers Agents to support the buyer\'s due diligence. It does not replace independent legal, building, or financial advice.',
  );

  footer(doc, settings);
  return docToBuffer(doc);
}
