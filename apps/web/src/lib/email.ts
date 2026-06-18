import { request } from '@/lib/api';
import type { EmailCampaign } from '@/types';

/**
 * Send a single transactional email through the backend relay. `bodyHtml` (rich
 * HTML, already interpolated) is wrapped in the branded shell server-side; `body`
 * is the plain-text fallback.
 */
export function sendEmail(
  to: string,
  subject: string,
  body: string,
  bodyHtml = '',
): Promise<{ ok: boolean }> {
  return request('POST', '/api/email/send', { to, subject, body, bodyHtml });
}

export interface BlastRecipient {
  email: string;
  name: string;
}

/** Audit metadata recorded alongside a blast (server creates the campaign record). */
export interface BlastCampaignMeta {
  dealId: string;
  templateId: string;
  agentGeoFilter: string[];
  preferredOnly: boolean;
}

export interface BlastResult {
  ok: boolean;
  sent: number;
  failed: number;
  campaign: EmailCampaign | null;
}

/** Send one personalized email per recipient ({{agentName}} resolved server-side). */
export function sendBlast(
  recipients: BlastRecipient[],
  subject: string,
  body: string,
  campaign?: BlastCampaignMeta,
  bodyHtml = '',
): Promise<BlastResult> {
  return request('POST', '/api/email/blast', { recipients, subject, body, bodyHtml, campaign });
}
