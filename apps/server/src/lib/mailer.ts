import sgMail from '@sendgrid/mail';
import { env, hasEmail } from '../env';

// SendGrid Web API (HTTPS) — chosen over SMTP so email works on hosts that
// block outbound SMTP ports (e.g. Render's free tier).
if (hasEmail) sgMail.setApiKey(env.EMAIL.apiKey);

const FROM = env.EMAIL.from;

/** Escape HTML and turn newlines into <br> so plain-text bodies render safely. */
function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div style="font-family:Inter,system-ui,sans-serif;font-size:14px;line-height:1.6;color:#111;white-space:pre-wrap">${escaped.replace(/\n/g, '<br>')}</div>`;
}

/**
 * Generic transactional send used by app features (templates, agent blasts)
 * and OTP. Throws on failure so callers can surface a real error.
 */
export interface MailAttachment {
  filename: string;
  content: Buffer;
  type: string;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  attachments?: MailAttachment[];
}): Promise<void> {
  if (!hasEmail) {
    throw new Error('Email is not configured (set SENDGRID_API_KEY).');
  }
  try {
    await sgMail.send({
      to: opts.to,
      from: FROM,
      subject: opts.subject,
      text: opts.text ?? '',
      html: opts.html ?? (opts.text ? textToHtml(opts.text) : ''),
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content.toString('base64'),
        type: a.type,
        disposition: 'attachment',
      })),
    });
  } catch (err: unknown) {
    // SendGrid surfaces useful detail on err.response.body.errors.
    const detail = (err as { response?: { body?: { errors?: Array<{ message?: string }> } } })?.response
      ?.body?.errors?.[0]?.message;
    throw new Error(detail || (err as Error).message || 'SendGrid send failed');
  }
}

function otpHtml(code: string): string {
  return `
  <div style="font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#111">
    <h2 style="margin:0 0 8px;font-family:'Playfair Display',Georgia,serif">Martelli Buyers</h2>
    <p style="color:#555;margin:0 0 24px">Your one-time sign-in code:</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;background:#f4f4f5;border-radius:12px;padding:18px;text-align:center">${code}</div>
    <p style="color:#888;font-size:13px;margin:24px 0 0">This code expires in ${env.OTP_TTL_MIN} minutes. If you didn't request it, you can ignore this email.</p>
  </div>`;
}

export async function sendOtpEmail(to: string, code: string): Promise<void> {
  // Always log the code in dev so the flow is testable without a provider.
  if (!env.isProd) console.log(`[mailer] OTP for ${to}: ${code}`);

  try {
    await sendMail({
      to,
      subject: 'Your Martelli Buyers sign-in code',
      text: `Your sign-in code is ${code}. It expires in ${env.OTP_TTL_MIN} minutes.`,
      html: otpHtml(code),
    });
  } catch (err) {
    // In prod a send failure is real. In dev (no key / offline) the code is
    // already logged, so don't block login.
    if (env.isProd) throw err;
    console.warn('[mailer] dev OTP email skipped —', (err as Error).message);
  }
}
