import { request, fetchBlob, triggerDownload } from './api'

/** Download a generated PDF from the server to the user's device. */
async function downloadPdf(path: string, filename: string): Promise<void> {
  const blob = await fetchBlob(path)
  triggerDownload(blob, filename)
}

/* ── Invoices ─────────────────────────────────────────────────────────── */

export function downloadInvoicePdf(id: string, invoiceNumber?: string): Promise<void> {
  return downloadPdf(`/api/documents/invoice/${id}.pdf`, `${invoiceNumber || 'invoice'}.pdf`)
}

export function emailInvoice(id: string): Promise<{ ok: boolean; status: string }> {
  return request('POST', `/api/documents/invoice/${id}/email`)
}

/* ── Due diligence ────────────────────────────────────────────────────── */

export function downloadDdReport(id: string, address?: string): Promise<void> {
  const safe = (address || 'dd-report').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
  return downloadPdf(`/api/documents/dd/${id}/report.pdf`, `dd-report-${safe}.pdf`)
}

/* ── Agreement ────────────────────────────────────────────────────────── */

export function downloadAgreementPdf(dealId: string): Promise<void> {
  return downloadPdf(`/api/documents/agreement/${dealId}.pdf`, 'agency-agreement.pdf')
}

export function sendAgreement(dealId: string): Promise<{ ok: boolean; signUrl: string; emailed: boolean }> {
  return request('POST', `/api/documents/agreement/${dealId}/send`)
}
