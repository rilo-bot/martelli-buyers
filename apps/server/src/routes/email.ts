import { Router } from 'express';
import { z } from 'zod';
import { sendMail } from '../lib/mailer';
import { asyncHandler } from '../middleware/error';

export const emailRouter = Router();

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
  asyncHandler(async (req, res) => {
    const { recipients, subject, body } = blastSchema.parse(req.body);

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
    res.json({ ok: true, sent, failed });
  }),
);
