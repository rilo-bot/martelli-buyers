import { Router } from 'express';
import { z } from 'zod';
import { generateMeetingSummary } from '../lib/ai';
import { hasAi } from '../env';
import { asyncHandler } from '../middleware/error';

export const aiRouter = Router();

const summarizeSchema = z.object({
  type: z.enum(['call', 'meeting']).default('call'),
  title: z.string().min(1),
  participants: z.array(z.string()).default([]),
  transcript: z.string().default(''),
});

/** POST /api/ai/summarize — generate a summary + action items from a transcript. */
aiRouter.post(
  '/summarize',
  asyncHandler(async (req, res) => {
    const input = summarizeSchema.parse(req.body);
    if (!hasAi) {
      res.status(503).json({ error: 'AI is not configured on the server.' });
      return;
    }
    try {
      const result = await generateMeetingSummary(input);
      res.json(result);
    } catch (err) {
      console.error('[ai] summarize failed:', err);
      res.status(502).json({ error: 'AI summary generation failed. Please try again.' });
    }
  }),
);
