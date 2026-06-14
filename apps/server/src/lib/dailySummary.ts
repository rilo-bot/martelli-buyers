import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env, hasAi } from '../env';
import { DailySummary } from '../models';
import { type AuthContext } from './permissions';
import { buildSnapshot, snapshotToLines, nzDate, type PortalSnapshot } from './portalData';

/**
 * Role-tailored, RBAC-scoped daily briefing for the dashboard.
 *
 * The portal snapshot (lib/portalData) is computed from the server-side
 * effective permissions, so the briefing naturally differs per role and never
 * leaks data the user couldn't otherwise see. Summaries are cached one-per-
 * user-per day (NZ date) to keep cost and latency down.
 */

/** In-app routes the briefing is allowed to deep-link to. */
const KNOWN_ROUTES = new Set([
  '/dashboard', '/leads', '/clients', '/journeys', '/invoices',
  '/properties', '/due-diligence', '/agents', '/emails', '/settings',
]);

export interface DailySummaryItem {
  text: string;
  to: string;
}
export interface DailySummaryResult {
  date: string;
  role: string;
  headline: string;
  insights: DailySummaryItem[];
  focus: string;
  generatedAt: string;
  cached: boolean;
}

/** Ask the model for a short, role-aware briefing from the snapshot. */
async function generateBriefing(
  auth: AuthContext,
  snapshot: PortalSnapshot,
): Promise<{ headline: string; insights: DailySummaryItem[]; focus: string }> {
  const openrouter = createOpenRouter({ apiKey: env.AI.apiKey });

  const schema = z.object({
    headline: z
      .string()
      .describe('One short, friendly sentence summarising the day for this user. No greeting like "Good morning".'),
    insights: z
      .array(
        z.object({
          text: z.string().describe('One concrete, specific insight or recommended action grounded ONLY in the metrics provided.'),
          to: z
            .string()
            .describe('Optional in-app route to act on it: one of /leads, /journeys, /invoices, /properties, /due-diligence, /agents, /emails, /clients. Empty string if none applies.'),
        }),
      )
      .max(5)
      .describe('Three to five prioritised insights, most urgent first. Empty array only if there is genuinely nothing to report.'),
    focus: z.string().describe("A single short 'focus for today' suggestion."),
  });

  const roleHint = auth.isSuperAdmin || auth.role === 'admin' || auth.role === 'manager'
    ? 'This user oversees the business — emphasise pipeline health, revenue/invoicing, stalled journeys and team-level priorities.'
    : 'This user works the day-to-day — emphasise their immediate follow-ups: leads to chase, tasks due, journeys needing action.';

  const metrics = snapshot.hasData
    ? snapshotToLines(snapshot).join('\n')
    : 'There is little or no data in the CRM yet.';

  const { object } = await generateObject({
    model: openrouter.chat(env.AI.model),
    schema,
    system:
      'You write a concise daily briefing for a staff member of a buyer’s-agent property CRM ' +
      'in Auckland, New Zealand. Be specific, practical and encouraging. ' +
      'Base every statement ONLY on the metrics provided — never invent numbers or facts. ' +
      'The metrics are already scoped to what this user is allowed to see; do not mention areas ' +
      'that are absent. ' + roleHint + ' ' +
      'If there is nothing meaningful to report, say so briefly and suggest a sensible starting point. ' +
      'No emojis. For each insight, set "to" to the most relevant in-app route or an empty string.',
    prompt:
      `User role: ${auth.role || (auth.isSuperAdmin ? 'super admin' : 'staff')}\n\n` +
      `Today's metrics:\n${metrics}`,
  });

  // Drop any deep link the model invented that isn't a real route.
  const insights = object.insights.map((i) => ({
    text: i.text,
    to: i.to && KNOWN_ROUTES.has(i.to) ? i.to : '',
  }));
  return { headline: object.headline, insights, focus: object.focus };
}

/** Loosely-typed session user (Mongoose doc). */
type SessionUser = { id?: string; _id?: unknown } | undefined;

/**
 * Return today's briefing for the user, generating + caching it on first call
 * of the day. `refresh` forces regeneration with the current data/permissions.
 */
export async function getDailySummary(
  auth: AuthContext,
  user: SessionUser,
  refresh = false,
): Promise<DailySummaryResult> {
  if (!hasAi) throw new Error('AI is not configured (set OPENROUTER_API_KEY).');

  const userId = String(user?.id ?? user?._id ?? '');
  const date = nzDate();

  if (!refresh) {
    const cached = await DailySummary.findOne({ userId, date }).lean();
    if (cached) {
      return {
        date,
        role: (cached as any).role ?? '',
        headline: (cached as any).headline ?? '',
        insights: ((cached as any).insights ?? []).map((i: any) => ({ text: i.text, to: i.to ?? '' })),
        focus: (cached as any).focus ?? '',
        generatedAt: (cached as any).generatedAt ?? '',
        cached: true,
      };
    }
  }

  const snapshot = await buildSnapshot(auth);
  const briefing = await generateBriefing(auth, snapshot);
  const generatedAt = new Date().toISOString();

  try {
    await DailySummary.findOneAndUpdate(
      { userId, date },
      {
        userId,
        date,
        role: auth.role ?? '',
        headline: briefing.headline,
        insights: briefing.insights,
        focus: briefing.focus,
        generatedAt,
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  } catch (err) {
    // A concurrent first-load for the same user/day can collide on the unique
    // (userId, date) index — harmless, the row now exists. Other errors rethrow.
    if (!(err instanceof Error && err.message.includes('E11000'))) throw err;
  }

  return { date, role: auth.role ?? '', ...briefing, generatedAt, cached: false };
}
