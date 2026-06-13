import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { AuditEvent, User } from '../models';

export const timelineRouter = Router();

/**
 * GET /api/timeline/deal/:dealId — the audit/timeline events for a Buyer Journey
 * and its child records (offers carry the same dealId), newest first. Actor names
 * are resolved here so the write path never has to look up the user.
 */
timelineRouter.get(
  '/deal/:dealId',
  requirePermission('journeys:view'),
  asyncHandler(async (req, res) => {
    const events = await AuditEvent.find({ dealId: req.params.dealId }).sort({ createdAt: -1 });

    // Backfill any missing actor names from the Users collection in one query.
    const actorIds = [...new Set(events.map((e) => e.get('actorId')).filter(Boolean))];
    const users = actorIds.length ? await User.find({ _id: { $in: actorIds } }).select('name email') : [];
    const nameById = new Map(users.map((u) => [String(u._id), u.get('name') || u.get('email') || '']));

    res.json(
      events.map((e) => {
        const json = e.toJSON() as Record<string, unknown>;
        if (!json.actorName && json.actorId) json.actorName = nameById.get(String(json.actorId)) ?? '';
        return json;
      }),
    );
  }),
);
