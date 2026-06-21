import { request, fetchBlob, triggerDownload } from './api'
import type { Invoice } from '@/types'

/** Download a generated PDF from the server to the user's device. */
async function downloadPdf(path: string, filename: string): Promise<void> {
  const blob = await fetchBlob(path)
  triggerDownload(blob, filename)
}

/* ── Preview paths ────────────────────────────────────────────────────────
 * Inline-streaming endpoints used by the in-app DocumentViewer (no `?download`,
 * so the server serves them for preview to anyone with view permission). The
 * matching `download…` helpers below append `?download=1`, which the server
 * gates to the document owner / admins.
 * ----------------------------------------------------------------------- */
export const invoicePdfPreviewPath = (id: string): string => `/api/documents/invoice/${id}.pdf`
export const ddReportPreviewPath = (id: string): string => `/api/documents/dd/${id}/report.pdf`
export const agreementPdfPreviewPath = (dealId: string): string => `/api/documents/agreement/${dealId}.pdf`

/* ── Invoices ─────────────────────────────────────────────────────────── */

export function downloadInvoicePdf(id: string, invoiceNumber?: string): Promise<void> {
  return downloadPdf(`/api/documents/invoice/${id}.pdf?download=1`, `${invoiceNumber || 'invoice'}.pdf`)
}

export function emailInvoice(id: string): Promise<{ ok: boolean; status: string }> {
  return request('POST', `/api/documents/invoice/${id}/email`)
}

/** Re-email an outstanding invoice as a reminder; returns the updated invoice. */
export function remindInvoice(id: string): Promise<Invoice> {
  return request('POST', `/api/documents/invoice/${id}/remind`)
}

/* ── Due diligence ────────────────────────────────────────────────────── */

export function downloadDdReport(id: string, address?: string): Promise<void> {
  const safe = (address || 'dd-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return downloadPdf(`/api/documents/dd/${id}/report.pdf?download=1`, `dd-report-${safe}.pdf`)
}

/* ── Agreement ────────────────────────────────────────────────────────── */

export function downloadAgreementPdf(dealId: string): Promise<void> {
  return downloadPdf(`/api/documents/agreement/${dealId}.pdf?download=1`, 'agency-agreement.pdf')
}

export function sendAgreement(dealId: string): Promise<{ ok: boolean; signUrl: string; emailed: boolean }> {
  return request('POST', `/api/documents/agreement/${dealId}/send`)
}

export interface AgreementContent {
  /** Rich-HTML agreement body for the WYSIWYG editor (seeded on first open). */
  bodyHtml: string
  /** True once signed — the agreement should no longer be edited. */
  locked: boolean
}

/** Fetch the editable agreement body for the WYSIWYG editor. */
export function getAgreementContent(dealId: string): Promise<AgreementContent> {
  return request('GET', `/api/documents/agreement/${dealId}/content`)
}
