import { Lead, Deal, Task, Invoice, Property, Client, Agent } from '../models';
import { viewableModules, type AuthContext } from './permissions';

/**
 * Shared, RBAC-scoped portal snapshot.
 *
 * A single source of truth for "state of the portal right now", used by both
 * the dashboard daily briefing and the assistant's `getDashboardMetrics` tool.
 * Every section is gathered ONLY if the user's role can view that module, so
 * the snapshot never contains data the user couldn't see in the UI.
 */

const DAY = 86_400_000;

/** 'YYYY-MM-DD' in Pacific/Auckland — the firm's day boundary. */
export function nzDate(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date());
}

const ms = (iso: unknown): number => {
  const t = new Date(String(iso ?? '')).getTime();
  return Number.isNaN(t) ? 0 : t;
};
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export interface PortalSnapshot {
  /** Module keys the user can view (drives which sections are present). */
  modules: string[];
  hasData: boolean;
  leads?: { total: number; open: number; idle3d: number; wonLast7d: number };
  journeys?: {
    active: number;
    byStage: Record<string, number>;
    stalled7d: number;
    agreementsAwaitingSignature: number;
  };
  tasks?: { open: number; dueOrOverdue: number; highPriority: number };
  invoices?: { overdue: number; overdueTotal: number; draft: number };
  properties?: { total: number; shortlistedOrViewed: number; offersPlaced: number };
  clients?: { total: number };
  agents?: { total: number; preferred: number };
}

/** Gather RBAC-scoped aggregate metrics. */
export async function buildSnapshot(auth: AuthContext): Promise<PortalSnapshot> {
  const can = viewableModules(auth);
  const now = Date.now();
  const weekAgo = now - 7 * DAY;
  const today = nzDate();

  const snap: PortalSnapshot = { modules: [...can], hasData: false };

  if (can.has('leads')) {
    const leads = await Lead.find({}, { status: 1, createdAt: 1, updatedAt: 1 }).lean();
    const open = leads.filter((l) => l.status === 'new' || l.status === 'contacted');
    snap.leads = {
      total: leads.length,
      open: open.length,
      idle3d: open.filter((l) => ms(l.createdAt) < now - 3 * DAY).length,
      wonLast7d: leads.filter((l) => l.status === 'won' && ms(l.updatedAt) >= weekAgo).length,
    };
    if (leads.length) snap.hasData = true;
  }

  if (can.has('journeys')) {
    const deals = await Deal.find({}, { stage: 1, updatedAt: 1, agreementStatus: 1 }).lean();
    const active = deals.filter((d) => d.stage !== 'complete');
    const byStage = active.reduce<Record<string, number>>((acc, d) => {
      acc[d.stage] = (acc[d.stage] ?? 0) + 1;
      return acc;
    }, {});
    snap.journeys = {
      active: active.length,
      byStage,
      stalled7d: active.filter((d) => ms(d.updatedAt) < weekAgo).length,
      agreementsAwaitingSignature: deals.filter((d) => d.agreementStatus === 'sent').length,
    };

    const tasks = await Task.find({ completed: false }, { dueDate: 1, priority: 1 }).lean();
    snap.tasks = {
      open: tasks.length,
      dueOrOverdue: tasks.filter((t) => t.dueDate && t.dueDate <= today).length,
      highPriority: tasks.filter((t) => t.priority === 'high').length,
    };
    if (deals.length || tasks.length) snap.hasData = true;
  }

  if (can.has('invoices')) {
    const invoices = await Invoice.find({}, { status: 1, dueDate: 1, total: 1 }).lean();
    const overdue = invoices.filter(
      (i) => i.status === 'overdue' || (i.status === 'sent' && i.dueDate && ms(i.dueDate) < now),
    );
    snap.invoices = {
      overdue: overdue.length,
      overdueTotal: overdue.reduce((s, i) => s + (i.total ?? 0), 0),
      draft: invoices.filter((i) => i.status === 'draft').length,
    };
    if (invoices.length) snap.hasData = true;
  }

  if (can.has('properties')) {
    const props = await Property.find({}, { status: 1 }).lean();
    snap.properties = {
      total: props.length,
      shortlistedOrViewed: props.filter((p) => p.status === 'shortlisted' || p.status === 'viewed').length,
      offersPlaced: props.filter((p) => p.status === 'offer_placed').length,
    };
    if (props.length) snap.hasData = true;
  }

  if (can.has('clients')) {
    const clients = await Client.estimatedDocumentCount();
    snap.clients = { total: clients };
    if (clients) snap.hasData = true;
  }

  if (can.has('agents')) {
    const [total, preferred] = await Promise.all([
      Agent.estimatedDocumentCount(),
      Agent.countDocuments({ isPreferred: true }),
    ]);
    snap.agents = { total, preferred };
    if (total) snap.hasData = true;
  }

  return snap;
}

/** Render a snapshot into human-readable metric lines for an AI prompt. */
export function snapshotToLines(s: PortalSnapshot): string[] {
  const lines: string[] = [];
  if (s.leads) {
    lines.push(
      `Leads: ${s.leads.total} total, ${s.leads.open} open (new/contacted), ` +
      `${s.leads.idle3d} idle 3+ days, ${s.leads.wonLast7d} won in the last 7 days.`,
    );
  }
  if (s.journeys) {
    const stageStr = Object.entries(s.journeys.byStage).map(([st, n]) => `${st}: ${n}`).join(', ') || 'none';
    lines.push(
      `Buyer journeys: ${s.journeys.active} active (${stageStr}), ` +
      `${s.journeys.stalled7d} stalled with no update in 7+ days, ` +
      `${s.journeys.agreementsAwaitingSignature} agreements sent but not yet signed.`,
    );
  }
  if (s.tasks) {
    lines.push(
      `Tasks: ${s.tasks.open} open, ${s.tasks.dueOrOverdue} due today or overdue, ` +
      `${s.tasks.highPriority} high priority.`,
    );
  }
  if (s.invoices) {
    lines.push(`Invoices: ${s.invoices.overdue} overdue (${money(s.invoices.overdueTotal)}), ${s.invoices.draft} in draft.`);
  }
  if (s.properties) {
    lines.push(
      `Properties: ${s.properties.total} tracked, ${s.properties.shortlistedOrViewed} shortlisted/viewed, ` +
      `${s.properties.offersPlaced} with an offer placed.`,
    );
  }
  if (s.clients) lines.push(`Clients: ${s.clients.total} total.`);
  if (s.agents) lines.push(`Agents: ${s.agents.total} in the network, ${s.agents.preferred} preferred.`);
  return lines;
}
