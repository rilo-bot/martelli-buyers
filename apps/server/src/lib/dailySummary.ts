import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateObject } from 'ai';
import { z } from 'zod';
import { env, hasAi } from '../env';
import { Lead, Deal, Task, Invoice, Property, Client, Agent, DailySummary } from '../models';
import { viewableModules, type AuthContext } from './permissions';

/**
 * Role-tailored, RBAC-scoped daily briefing for the dashboard.
 *
 * Everything here is computed from the server-side effective permissions: a
 * section of the snapshot is only gathered if the user's role can VIEW that
 * module, so the resulting summary naturally differs per role and never leaks
 * data the user couldn't otherwise see. Summaries are cached one-per-user-per
 * day (NZ date) to keep cost and latency down.
 */

const DAY = 86_400_000;

/** In-app routes the briefing is allowed to deep-link to. */
const KNOWN_ROUTES = new Set([
  '/dashboard', '/leads', '/clients', '/journeys', '/invoices',
  '/properties', '/due-diligence', '/agents', '/emails', '/settings',
]);

/** 'YYYY-MM-DD' in Pacific/Auckland — the firm's day boundary. */
function nzDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date());
}

const ms = (iso: unknown): number => {
  const t = new Date(String(iso ?? '')).getTime();
  return Number.isNaN(t) ? 0 : t;
};
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

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

interface Snapshot {
  /** Human-readable metric lines fed to the model. */
  lines: string[];
  hasData: boolean;
}

/** Gather RBAC-scoped aggregate metrics for the briefing. */
async function buildSnapshot(auth: AuthContext): Promise<Snapshot> {
  const can = viewableModules(auth);
  const now = Date.now();
  const weekAgo = now - 7 * DAY;
  const today = nzDate();
  const lines: string[] = [];
  let hasData = false;

  if (can.has('leads')) {
    const leads = await Lead.find({}, { status: 1, createdAt: 1, updatedAt: 1, budget: 1 }).lean();
    const open = leads.filter((l) => l.status === 'new' || l.status === 'contacted');
    const idle = open.filter((l) => ms(l.createdAt) < now - 3 * DAY);
    const won = leads.filter((l) => l.status === 'won' && ms(l.updatedAt) >= weekAgo);
    lines.push(
      `Leads: ${leads.length} total, ${open.length} open (new/contacted), ` +
      `${idle.length} idle 3+ days, ${won.length} won in the last 7 days.`,
    );
    if (leads.length) hasData = true;
  }

  if (can.has('journeys')) {
    const deals = await Deal.find({}, { stage: 1, updatedAt: 1, agreementStatus: 1 }).lean();
    const active = deals.filter((d) => d.stage !== 'complete');
    const stalled = active.filter((d) => ms(d.updatedAt) < weekAgo);
    const awaitingSig = deals.filter((d) => d.agreementStatus === 'sent');
    const byStage = active.reduce<Record<string, number>>((acc, d) => {
      acc[d.stage] = (acc[d.stage] ?? 0) + 1;
      return acc;
    }, {});
    const stageStr = Object.entries(byStage).map(([s, n]) => `${s}: ${n}`).join(', ') || 'none';
    lines.push(
      `Buyer journeys: ${active.length} active (${stageStr}), ` +
      `${stalled.length} stalled with no update in 7+ days, ` +
      `${awaitingSig.length} agreements sent but not yet signed.`,
    );

    const tasks = await Task.find({ completed: false }, { dueDate: 1, priority: 1 }).lean();
    const dueOrOverdue = tasks.filter((t) => t.dueDate && t.dueDate <= today);
    const highPriority = tasks.filter((t) => t.priority === 'high');
    lines.push(
      `Tasks: ${tasks.length} open, ${dueOrOverdue.length} due today or overdue, ` +
      `${highPriority.length} high priority.`,
    );
    if (deals.length || tasks.length) hasData = true;
  }

  if (can.has('invoices')) {
    const invoices = await Invoice.find({}, { status: 1, dueDate: 1, total: 1 }).lean();
    const overdue = invoices.filter(
      (i) => i.status === 'overdue' || (i.status === 'sent' && i.dueDate && ms(i.dueDate) < now),
    );
    const overdueTotal = overdue.reduce((s, i) => s + (i.total ?? 0), 0);
    const draft = invoices.filter((i) => i.status === 'draft');
    lines.push(
      `Invoices: ${overdue.length} overdue (${money(overdueTotal)}), ${draft.length} in draft.`,
    );
    if (invoices.length) hasData = true;
  }

  if (can.has('properties')) {
    const props = await Property.find({}, { status: 1 }).lean();
    const shortlisted = props.filter((p) => p.status === 'shortlisted' || p.status === 'viewed');
    const offers = props.filter((p) => p.status === 'offer_placed');
    lines.push(
      `Properties: ${props.length} tracked, ${shortlisted.length} shortlisted/viewed, ` +
      `${offers.length} with an offer placed.`,
    );
    if (props.length) hasData = true;
  }

  if (can.has('clients')) {
    const clients = await Client.estimatedDocumentCount();
    lines.push(`Clients: ${clients} total.`);
    if (clients) hasData = true;
  }

  if (can.has('agents')) {
    const [agents, preferred] = await Promise.all([
      Agent.estimatedDocumentCount(),
      Agent.countDocuments({ isPreferred: true }),
    ]);
    lines.push(`Agents: ${agents} in the network, ${preferred} preferred.`);
    if (agents) hasData = true;
  }

  return { lines, hasData };
}

/** Ask the model for a short, role-aware briefing from the snapshot. */
async function generateBriefing(
  auth: AuthContext,
  snapshot: Snapshot,
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
    ? snapshot.lines.join('\n')
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

  return { date, role: auth.role ?? '', ...briefing, generatedAt, cached: false };
}
