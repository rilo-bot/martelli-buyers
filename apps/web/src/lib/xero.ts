import { apiUrl, request } from './api'
import type { Client, Invoice } from '@/types'

export type XeroImportStatus = 'idle' | 'running' | 'done' | 'error'

export interface XeroStatus {
  configured: boolean
  connected: boolean
  tenantName: string
  connectedByEmail: string
  expiresAt: string | null
  importStatus: XeroImportStatus
  lastImportAt: string
  importedClients: number
  linkedInvoices: number
}

/** Full-page navigation target to start the OAuth handshake (not a fetch). */
export function xeroConnectUrl(): string {
  return apiUrl('/api/xero/connect')
}

export function getXeroStatus(): Promise<XeroStatus> {
  return request('GET', '/api/xero/status')
}

export function disconnectXero(): Promise<{ ok: boolean }> {
  return request('POST', '/api/xero/disconnect')
}

export function pushInvoiceToXero(id: string): Promise<Invoice> {
  return request('POST', `/api/xero/invoice/${id}/push`)
}

export function refreshInvoiceFromXero(id: string): Promise<Invoice> {
  return request('POST', `/api/xero/invoice/${id}/refresh`)
}

/** Re-run the contact/invoice pull from Xero (idempotent). */
export function runXeroImport(): Promise<{ ok: boolean; importStatus: XeroImportStatus }> {
  return request('POST', '/api/xero/import')
}

/** Manually push a single client to Xero as a contact. */
export function pushClientToXero(id: string): Promise<Client> {
  return request('POST', `/api/xero/contact/${id}/push`)
}
