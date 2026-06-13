import { request } from './api'
import type { AuditEvent } from '@/types'

/** Fetch the timeline/audit events for a Buyer Journey (deal), newest first. */
export function getDealTimeline(dealId: string): Promise<AuditEvent[]> {
  return request('GET', `/api/timeline/deal/${dealId}`)
}
