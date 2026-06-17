import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { DueDiligence } from '../models';

export const journeysRouter = Router();

/**
 * GET /api/journeys/:dealId/comparables — comparable sales recorded across this
 * Buyer Journey's due-diligence records, scoped to `journeys:view`. Comparables
 * physically live inside DD records (which require `dueDiligence:view`), but the
 * journey's Comparables tab needs to surface them to anyone who can view the
 * journey — so this read-only endpoint exposes just the comparables, nothing
 * else from the DD record.
 */
journeysRouter.get(
  '/:dealId/comparables',
  requirePermission('journeys:view'),
  asyncHandler(async (req, res) => {
    const records = await DueDiligence.find({
      dealId: req.params.dealId,
      'comparableSales.0': { $exists: true },
    }).sort({ createdAt: 1 });

    res.json(
      records.map((r) => {
        const json = r.toJSON() as Record<string, unknown>;
        return {
          id: json.id,
          propertyId: json.propertyId ?? '',
          address: json.address ?? '',
          comparableSales: json.comparableSales ?? [],
        };
      }),
    );
  }),
);
