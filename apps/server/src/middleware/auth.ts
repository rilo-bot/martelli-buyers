import type { Request, Response, NextFunction } from 'express';
import { User } from '../models';
import { getEffectivePermissions } from '../lib/permissions';

/** Blocks the request unless a valid session user exists. Attaches req.user + req.auth. */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const user = await User.findById(userId);
  if (!user) {
    // Session points at a deleted user — clear it.
    req.session.destroy(() => {});
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { permissions, isSuperAdmin } = await getEffectivePermissions({
    email: user.get('email'),
    role: user.get('role'),
  });
  req.user = user;
  req.auth = { user, permissions, isSuperAdmin };
  next();
}
