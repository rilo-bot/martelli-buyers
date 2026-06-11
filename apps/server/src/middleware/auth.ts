import type { Request, Response, NextFunction } from 'express';
import { User } from '../models';

/** Blocks the request unless a valid session user exists. Attaches req.user. */
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
  (req as Request & { user?: unknown }).user = user;
  next();
}
