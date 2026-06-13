import { Router } from 'express';
import { z } from 'zod';
import { generateMeetingSummary } from '../lib/ai';
import { streamAssistantReply } from '../lib/assistant';
import { getDailySummary } from '../lib/dailySummary';
import { authContextFromRequest } from '../lib/permissions';
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

const assistantSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(4000),
      }),
    )
    .min(1)
    // Cap history so the prompt stays bounded; keep the most recent exchange.
    .transform((m) => m.slice(-12)),
  currentPath: z.string().max(200).optional(),
});

/** POST /api/ai/assistant — stream a how-to guide reply for the in-app helper. */
aiRouter.post(
  '/assistant',
  asyncHandler(async (req, res) => {
    const input = assistantSchema.parse(req.body);
    if (!hasAi) {
      res.status(503).json({ error: 'AI is not configured on the server.' });
      return;
    }
    try {
      const result = streamAssistantReply(
        input.messages,
        input.currentPath,
        authContextFromRequest(req),
      );
      // Plain text stream — the AI SDK pipes chunks and ends the response
      // (including the terminating chunk) so the browser's reader sees `done`.
      result.pipeTextStreamToResponse(res, {
        headers: { 'Cache-Control': 'no-cache, no-transform' },
      });
    } catch (err) {
      console.error('[ai] assistant failed:', err);
      if (!res.headersSent) {
        res.status(502).json({ error: 'Assistant is unavailable right now. Please try again.' });
      } else if (!res.writableEnded) {
        res.end();
      }
    }
  }),
);

/**
 * GET /api/ai/daily-summary — a role-tailored, RBAC-scoped daily briefing for
 * the dashboard. Cached one-per-user-per-day; `?refresh=1` forces regeneration.
 */
aiRouter.get(
  '/daily-summary',
  asyncHandler(async (req, res) => {
    if (!hasAi) {
      res.status(503).json({ error: 'AI is not configured on the server.' });
      return;
    }
    try {
      const refresh = req.query.refresh === '1' || req.query.refresh === 'true';
      const summary = await getDailySummary(authContextFromRequest(req), req.user, refresh);
      res.json(summary);
    } catch (err) {
      console.error('[ai] daily summary failed:', err);
      res.status(502).json({ error: 'Could not generate your daily briefing. Please try again.' });
    }
  }),
);
