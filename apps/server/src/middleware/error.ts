import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

/** Wrap async route handlers so thrown errors hit the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: err.flatten() });
    return;
  }
  const e = err as { name?: string; message?: string };
  if (e?.name === 'CastError') {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  console.error('[error]', err);
  res.status(500).json({ error: e?.message ?? 'Internal server error' });
}
