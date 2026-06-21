import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { hasMeet } from '../env';
import { listMeetings, createMeeting } from '../lib/riloMeet';

/**
 * RILO Meet proxy. The browser never holds the API key — it calls these gated
 * endpoints and the server forwards to the external RILO Meet service. Upstream
 * status codes and bodies are passed straight through so the client surfaces
 * RILO's own validation errors (e.g. host_not_found, invalid_scheduledStartAt).
 */
export const meetRouter = Router();

/** 503 helper for when no API key is configured on the server. */
function ensureConfigured(res: import('express').Response): boolean {
  if (!hasMeet) {
    res.status(503).json({ error: 'RILO Meet is not configured on the server.' });
    return false;
  }
  return true;
}

/** GET /api/meet/meetings?status=live — list meetings. */
meetRouter.get(
  '/meetings',
  requirePermission('meet:view'),
  asyncHandler(async (req, res) => {
    if (!ensureConfigured(res)) return;
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : undefined;
    const result = await listMeetings(status);
    res.status(result.status).json(result.data ?? {});
  }),
);

const createSchema = z.object({
  hostEmail: z.string().email(),
  title: z.string().trim().min(1, 'Title is required'),
  participants: z.array(z.string().email()).optional().default([]),
  // Both schedule fields are optional, but RILO requires them together — if one
  // is present the other must be too (validated below).
  scheduledStartAt: z.string().trim().min(1).optional(),
  scheduledDurationMinutes: z.number().int().positive().optional(),
}).refine(
  (v) => (v.scheduledStartAt === undefined) === (v.scheduledDurationMinutes === undefined),
  { message: 'A scheduled meeting needs both a start time and a duration.' },
);

/** POST /api/meet/meetings — create an instant or scheduled meeting. */
meetRouter.post(
  '/meetings',
  requirePermission('meet:create'),
  asyncHandler(async (req, res) => {
    if (!ensureConfigured(res)) return;
    const input = createSchema.parse(req.body);
    const result = await createMeeting(input);
    res.status(result.status).json(result.data ?? {});
  }),
);
