import { request } from '@/lib/api';
import type { EmailCampaign } from '@/types';

/** Send a single transactional email through the backend SMTP relay. */
export function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean }> {
  return request('POST', '/api/email/send', { to, subject, body });
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
): Promise<BlastResult> {
  return request('POST', '/api/email/blast', { recipients, subject, body, campaign });
}
