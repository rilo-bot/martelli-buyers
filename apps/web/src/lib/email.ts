import { request } from '@/lib/api';

/** Send a single transactional email through the backend SMTP relay. */
export function sendEmail(to: string, subject: string, body: string): Promise<{ ok: boolean }> {
  return request('POST', '/api/email/send', { to, subject, body });
}

export interface BlastRecipient {
  email: string;
  name: string;
}

/** Send one personalized email per recipient ({{agentName}} resolved server-side). */
export function sendBlast(
  recipients: BlastRecipient[],
  subject: string,
  body: string,
): Promise<{ ok: boolean; sent: number; failed: number }> {
  return request('POST', '/api/email/blast', { recipients, subject, body });
}
