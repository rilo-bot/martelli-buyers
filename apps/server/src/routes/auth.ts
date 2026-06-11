import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User, OtpToken } from '../models';
import { generateCode, hashCode, verifyCode, MAX_OTP_ATTEMPTS } from '../lib/otp';
import { sendOtpEmail } from '../lib/mailer';
import { asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { env } from '../env';

export const authRouter = Router();

// Throttle code requests: max 5 per 10 min per IP.
const requestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many code requests. Please wait a few minutes and try again.' },
});

const requestSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

/** POST /api/auth/request-otp — email a one-time code. Always returns 200. */
authRouter.post(
  '/request-otp',
  requestLimiter,
  asyncHandler(async (req, res) => {
    const { email, name } = requestSchema.parse(req.body);
    const normalized = email.trim().toLowerCase();

    const code = generateCode();
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + env.OTP_TTL_MIN * 60 * 1000);

    // Supersede any prior unconsumed tokens for this email.
    await OtpToken.deleteMany({ email: normalized, consumed: false });
    await OtpToken.create({ email: normalized, codeHash, expiresAt, pendingName: name ?? '' });

    try {
      await sendOtpEmail(normalized, code);
    } catch (err) {
      console.error('[auth] failed to send OTP email:', err);
      // Do not leak delivery failures to the client beyond a generic message.
      res.status(502).json({ error: 'Could not send the code email. Please try again.' });
      return;
    }

    res.json({ ok: true });
  }),
);

/** POST /api/auth/verify-otp — verify code, create session, return the user. */
authRouter.post(
  '/verify-otp',
  asyncHandler(async (req, res) => {
    const { email, code } = verifySchema.parse(req.body);
    const normalized = email.trim().toLowerCase();

    const token = await OtpToken.findOne({ email: normalized, consumed: false }).sort({ createdAt: -1 });
    if (!token || token.expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: 'This code has expired. Please request a new one.' });
      return;
    }
    if (token.attempts >= MAX_OTP_ATTEMPTS) {
      res.status(429).json({ error: 'Too many incorrect attempts. Please request a new code.' });
      return;
    }

    const ok = await verifyCode(code, token.codeHash);
    if (!ok) {
      token.attempts += 1;
      await token.save();
      res.status(400).json({ error: 'Incorrect code. Please try again.' });
      return;
    }

    token.consumed = true;
    await token.save();

    let user = await User.findOne({ email: normalized });
    if (!user) {
      const isFirstUser = (await User.estimatedDocumentCount()) === 0;
      user = await User.create({
        email: normalized,
        name: token.pendingName || normalized.split('@')[0],
        role: isFirstUser ? 'admin' : 'staff',
      });
    } else if (token.pendingName && !user.name) {
      user.name = token.pendingName;
      await user.save();
    }

    req.session.userId = String(user._id);
    res.json(user.toJSON());
  }),
);

/** POST /api/auth/logout — destroy the session. */
authRouter.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('rilo.sid');
    res.json({ ok: true });
  });
});

/** GET /api/auth/me — current user (401 if not signed in). */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json((req as { user?: { toJSON(): unknown } }).user!.toJSON());
  }),
);
