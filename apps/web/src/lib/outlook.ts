import { apiUrl, request } from './api'
import type { OutlookStatus } from '@/types'

export type { OutlookStatus }

/** Full-page navigation target to start the OAuth handshake (not a fetch). */
export function outlookConnectUrl(): string {
  return apiUrl('/api/outlook/connect')
}

export function getOutlookStatus(): Promise<OutlookStatus> {
  return request('GET', '/api/outlook/status')
}

export function disconnectOutlook(): Promise<{ ok: boolean }> {
  return request('POST', '/api/outlook/disconnect')
}

/** Trigger a manual delta sync (idempotent; runs in the background server-side). */
export function runOutlookSync(): Promise<{ ok: boolean; syncStatus: OutlookStatus['syncStatus'] }> {
  return request('POST', '/api/outlook/sync')
}

/** Browser URL to stream an email attachment (auth cookie sent automatically). */
export function attachmentUrl(messageId: string, attachmentId: string): string {
  return apiUrl(`/api/outlook/messages/${messageId}/attachments/${attachmentId}`)
}
