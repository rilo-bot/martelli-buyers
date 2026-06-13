import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { User, OtpToken } from '../models';
import { generateCode, hashCode, verifyCode, MAX_OTP_ATTEMPTS } from '../lib/otp';
import { sendOtpEmail } from '../lib/mailer';
import { asyncHandler } from '../middleware/error';
import { requireAuth } from '../middleware/auth';
import { getEffectivePermissions } from '../lib/permissions';
import { env } from '../env';

export const authRouter = Router();

/** Serialise a user for the session client, with effective RBAC fields. */
async function buildSessionUser(user: { toJSON(): Record<string, unknown>; get(k: string): unknown }) {
  const { permissions, isSuperAdmin } = await getEffectivePermissions({
    email: user.get('email') as string,
    role: user.get('role') as string,
  });
  return { ...user.toJSON(), permissions: Array.from(permissions), isSuperAdmin };
}

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
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, 'Code must be 6 digits'),
});

const acceptSchema = z.object({
  token: z.string().min(10),
});

/**
 * POST /api/auth/request-otp — email a one-time sign-in code. Self-signup is
 * disabled: a code is only sent to an email that already has an account. The
 * response is always {ok:true} so the endpoint never reveals which emails exist.
 */
authRouter.post(
  '/request-otp',
  requestLimiter,
  asyncHandler(async (req, res) => {
    const { email } = requestSchema.parse(req.body);
    const normalized = email.trim().toLowerCase();

    // No account → no code (but don't leak that to the caller).
    if (!(await User.exists({ email: normalized }))) {
      res.json({ ok: true });
      return;
    }

    const code = generateCode();
    const codeHash = await hashCode(code);
    const expiresAt = new Date(Date.now() + env.OTP_TTL_MIN * 60 * 1000);

    // Supersede any prior unconsumed tokens for this email.
    await OtpToken.deleteMany({ email: normalized, consumed: false });
    await OtpToken.create({ email: normalized, codeHash, expiresAt });

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

    // Accounts are never created here — only an admin invite (or the env super
    // admin) can provision a user. An unknown email cannot sign in.
    const user = await User.findOne({ email: normalized });
    if (!user) {
      res.status(400).json({ error: 'No account found for this email — ask your administrator for an invite.' });
      return;
    }

    token.consumed = true;
    await token.save();

    // First successful login also activates a still-pending invited account.
    if (user.get('status') !== 'active') user.set('status', 'active');
    await user.save();

    req.session.userId = String(user._id);
    res.json(await buildSessionUser(user));
  }),
);

/**
 * POST /api/auth/accept-invite — open an invite link to auto-login. The token
 * is the only credential; on success it establishes a session, activates the
 * account, and burns the token (single-use).
 */
authRouter.post(
  '/accept-invite',
  requestLimiter,
  asyncHandler(async (req, res) => {
    const { token } = acceptSchema.parse(req.body);
    const user = await User.findOne({ inviteToken: token }).select('+inviteToken +inviteExpiresAt');
    const expiresAt = user?.get('inviteExpiresAt') as Date | undefined;
    if (!user || !expiresAt || expiresAt.getTime() < Date.now()) {
      res.status(400).json({ error: 'This invite link is invalid or has expired.' });
      return;
    }
    user.set('status', 'active');
    user.set('inviteToken', '');
    user.set('inviteExpiresAt', undefined);
    await user.save();

    req.session.userId = String(user._id);
    res.json(await buildSessionUser(user));
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
    res.json(await buildSessionUser(req.user));
  }),
);
