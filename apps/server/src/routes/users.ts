import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { outranksRole } from '@rilo/shared';
import { User, Role } from '../models';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { sendInviteEmail } from '../lib/mailer';
import { env, isSuperAdminEmail } from '../env';

export const usersRouter = Router();

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional().default(''),
  role: z.string().trim().min(1),
});

const updateSchema = z.object({
  name: z.string().trim().max(120).optional(),
  role: z.string().trim().min(1).optional(),
});

async function roleExists(key: string): Promise<boolean> {
  return Boolean(await Role.exists({ key }));
}

/** Generate a fresh single-use invite token + expiry. */
function newInvite(): { token: string; expiresAt: Date } {
  return {
    token: randomBytes(24).toString('hex'),
    expiresAt: new Date(Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000),
  };
}

const inviteUrl = (token: string) => `${env.CLIENT_ORIGIN.replace(/\/+$/, '')}/invite/${token}`;

/**
 * GET /api/users — list users. Left open to any authenticated user because
 * assignment dropdowns across the app need names/ids. (Low sensitivity: name,
 * email, role, status only — the invite token is select:false and never sent.)
 */
usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await User.find().sort({ createdAt: 1 });
    // Tag the env super admin so the client can lock that row (the flag is
    // computed from the env email, never persisted on the document).
    res.json(users.map((u) => ({ ...u.toJSON(), isSuperAdmin: isSuperAdminEmail(u.get('email')) })));
  }),
);

/** POST /api/users — invite a new user (needs team:manage). Returns { user, inviteUrl }. */
usersRouter.post(
  '/',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) => {
    const { email, name, role } = createSchema.parse(req.body ?? {});
    const normalized = email.trim().toLowerCase();
    if (!(await roleExists(role))) {
      res.status(400).json({ error: 'Unknown role.' });
      return;
    }
    // Hierarchy: you can only invite users with a role below your own level.
    if (!outranksRole(role, String(req.auth?.user?.get?.('role') ?? ''), Boolean(req.auth?.isSuperAdmin))) {
      res.status(403).json({ error: 'You can only invite users with a role below your own role level.' });
      return;
    }
    if (await User.exists({ email: normalized })) {
      res.status(400).json({ error: 'A user with this email already exists.' });
      return;
    }
    const { token, expiresAt } = newInvite();
    const user = await User.create({
      email: normalized,
      name,
      role,
      status: 'invited',
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    });
    const url = inviteUrl(token);
    // Best-effort email — the admin also gets the link back to copy/share.
    await sendInviteEmail(normalized, name, url).catch((err) =>
      console.error('[users] invite email failed:', (err as Error).message),
    );
    res.status(201).json({ user: user.toJSON(), inviteUrl: url });
  }),
);

/** POST /api/users/:id/invite — regenerate + resend an invite (needs team:manage). */
usersRouter.post(
  '/:id/invite',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    const { token, expiresAt } = newInvite();
    user.set('inviteToken', token);
    user.set('inviteExpiresAt', expiresAt);
    if (user.get('status') !== 'active') user.set('status', 'invited');
    await user.save();
    const url = inviteUrl(token);
    await sendInviteEmail(user.get('email'), user.get('name'), url).catch((err) =>
      console.error('[users] invite email failed:', (err as Error).message),
    );
    res.json({ user: user.toJSON(), inviteUrl: url });
  }),
);

/** PATCH /api/users/:id — update name/role (needs team:manage). */
usersRouter.patch(
  '/:id',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) => {
    const patch = updateSchema.parse(req.body ?? {});
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (patch.role !== undefined) {
      // The super admin's role is a fixed invariant — nobody can reassign it,
      // not even the super admin themselves (their access comes from the env).
      if (isSuperAdminEmail(user.get('email'))) {
        res.status(400).json({ error: "The super admin's role cannot be changed." });
        return;
      }
      // Nobody changes their own role — not even an admin.
      if (String(user._id) === req.session.userId) {
        res.status(400).json({ error: 'You cannot change your own role.' });
        return;
      }
      // Hierarchy: super admin > admin > manager > staff. You may only manage a
      // user below your level, and only assign a role below your level — so the
      // super admin owns admins, admins own manager/staff, managers own staff.
      const isSuper = Boolean(req.auth?.isSuperAdmin);
      const reqRole = String(req.auth?.user?.get?.('role') ?? '');
      if (!outranksRole(String(user.get('role')), reqRole, isSuper)) {
        res.status(403).json({ error: 'You can only manage team members below your own role level.' });
        return;
      }
      if (!outranksRole(patch.role, reqRole, isSuper)) {
        res.status(403).json({ error: 'You can only assign roles below your own role level.' });
        return;
      }
      if (!(await roleExists(patch.role))) {
        res.status(400).json({ error: 'Unknown role.' });
        return;
      }
      user.set('role', patch.role);
    }
    if (patch.name !== undefined) user.set('name', patch.name);
    await user.save();
    res.json(user.toJSON());
  }),
);

/** DELETE /api/users/:id — remove a user / cancel an invite (needs team:manage). */
usersRouter.delete(
  '/:id',
  requirePermission('team:manage'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    if (isSuperAdminEmail(user.get('email'))) {
      res.status(400).json({ error: 'The super admin account cannot be deleted.' });
      return;
    }
    if (String(user._id) === req.session.userId) {
      res.status(400).json({ error: 'You cannot delete your own account.' });
      return;
    }
    // Hierarchy: you can only remove team members below your own role level.
    if (!outranksRole(String(user.get('role')), String(req.auth?.user?.get?.('role') ?? ''), Boolean(req.auth?.isSuperAdmin))) {
      res.status(403).json({ error: 'You can only remove team members below your own role level.' });
      return;
    }
    await user.deleteOne();
    res.json({ ok: true });
  }),
);
