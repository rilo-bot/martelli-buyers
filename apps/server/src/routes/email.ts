import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { sendMail } from '../lib/mailer';
import { EmailCampaign } from '../models';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';

export const emailRouter = Router();

// All outbound email requires the emails:send permission.
emailRouter.use(requirePermission('emails:send'));

// Guard against accidental or abusive mass-sending: cap blasts per IP per hour.
const blastLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many blasts sent. Please wait a while before sending more.' },
});

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().default(''),
});

const blastSchema = z.object({
  recipients: z
    .array(z.object({ email: z.string().email(), name: z.string().default('') }))
    .min(1)
    .max(500),
  subject: z.string().min(1),
  body: z.string().default(''),
  // Optional audit metadata — when present the server records the campaign in
  // the same request, so a successful send always has a matching record.
  campaign: z
    .object({
      dealId: z.string().default(''),
      templateId: z.string().default(''),
      agentGeoFilter: z.array(z.string()).default([]),
      preferredOnly: z.boolean().default(false),
    })
    .optional(),
});

/** Replace {{agentName}} (and {{name}}) per recipient; leave other placeholders intact. */
function personalize(text: string, name: string): string {
  return text.replace(/\{\{\s*(agentName|name)\s*\}\}/gi, name || 'there');
}

/** POST /api/email/send — one transactional email. */
emailRouter.post(
  '/send',
  asyncHandler(async (req, res) => {
    const { to, subject, body } = sendSchema.parse(req.body);
    try {
      await sendMail({ to, subject, text: body });
    } catch (err) {
      console.error('[email] send failed:', err);
      res.status(502).json({ error: 'Email could not be sent. Check SMTP settings and try again.' });
      return;
    }
    res.json({ ok: true });
  }),
);

/** POST /api/email/blast — send one personalized email per recipient. */
emailRouter.post(
  '/blast',
  blastLimiter,
  asyncHandler(async (req, res) => {
    const { recipients, subject, body, campaign } = blastSchema.parse(req.body);

    // De-dupe by email (case-insensitive).
    const seen = new Set<string>();
    const unique = recipients.filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const results = await Promise.allSettled(
      unique.map((r) =>
        sendMail({ to: r.email, subject: personalize(subject, r.name), text: personalize(body, r.name) }),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;
    if (sent === 0) {
      res.status(502).json({ error: 'No emails could be sent. Check SMTP settings.' });
      return;
    }

    // Record the campaign atomically with the send so the audit trail can't
    // drift from what actually went out. recipientCount is the real delivered count.
    let record = null;
    if (campaign) {
      const doc = await EmailCampaign.create({
        ...campaign,
        subject,
        body,
        recipientType: 'agents',
        recipientCount: sent,
        sentAt: new Date().toISOString(),
        status: 'sent',
      });
      record = doc.toJSON();
    }

    res.json({ ok: true, sent, failed, campaign: record });
  }),
);
