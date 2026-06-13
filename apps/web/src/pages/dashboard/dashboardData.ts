import { useMemo } from 'react';
import { useLeadsStore } from '@/stores/leadsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useAgentsStore } from '@/stores/agentsStore';
import type { DealStage } from '@/types';
import type { LucideIcon } from 'lucide-react';
import {
  Users, FileText, Home, DollarSign, Clock, AlertTriangle, FileSignature,
  UserPlus, Trophy, Receipt, ArrowRightLeft,
} from 'lucide-react';

const DAY = 86_400_000;
const STAGE_ORDER: DealStage[] = ['qualification', 'search', 'shortlisting', 'due_diligence', 'offer', 'settlement', 'complete'];
const STAGE_LABELS: Record<DealStage, string> = {
  qualification: 'Qualification', search: 'Search', shortlisting: 'Shortlisting',
  due_diligence: 'Due Diligence', offer: 'Offer', settlement: 'Settlement', complete: 'Complete',
};

const ms = (iso: string) => { const t = new Date(iso).getTime(); return Number.isNaN(t) ? 0 : t; };

/** Count items per week for the last `weeks` weeks (oldest → newest). */
function weeklySeries(dates: number[], now: number, weeks = 8): number[] {
  const out = new Array(weeks).fill(0);
  for (const t of dates) {
    const idx = weeks - 1 - Math.floor((now - t) / (7 * DAY));
    if (idx >= 0 && idx < weeks) out[idx] += 1;
  }
  return out;
}
function weeklySum(entries: { t: number; v: number }[], now: number, weeks = 8): number[] {
  const out = new Array(weeks).fill(0);
  for (const { t, v } of entries) {
    const idx = weeks - 1 - Math.floor((now - t) / (7 * DAY));
    if (idx >= 0 && idx < weeks) out[idx] += v;
  }
  return out;
}

export interface KpiDatum {
  key: string; label: string; value: number; format?: (n: number) => string;
  icon: LucideIcon; to: string; spark: number[]; delta: number; deltaLabel: string;
}
export interface AttentionItem { key: string; label: string; count: number; sub: string; icon: LucideIcon; to: string }
export interface FunnelStage { stage: DealStage; label: string; count: number; value: number; pct: number }
export interface RevenuePoint { label: string; collected: number; invoiced: number }
export interface ActivityItem { id: string; icon: LucideIcon; text: string; sub: string; ts: number; to: string }

export interface DashboardData {
  kpis: KpiDatum[];
  attention: AttentionItem[];
  funnel: FunnelStage[];
  revenue: RevenuePoint[];
  activity: ActivityItem[];
  hasAnyData: boolean;
}

const money = (n: number) => `$${n.toLocaleString()}`;

export function useDashboardData(): DashboardData {
  const leads = useLeadsStore((s) => s.leads);
  const deals = useDealsStore((s) => s.deals);
  const properties = usePropertiesStore((s) => s.properties);
  const invoices = useInvoicesStore((s) => s.invoices);
  const agents = useAgentsStore((s) => s.agents);

  return useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * DAY;
    const twoWeeksAgo = now - 14 * DAY;
    const countNew = (dates: number[]) => ({
      thisWk: dates.filter((t) => t >= weekAgo).length,
      lastWk: dates.filter((t) => t >= twoWeeksAgo && t < weekAgo).length,
    });

    // ── KPIs ──
    const leadDates = leads.map((l) => ms(l.createdAt));
    const dealDates = deals.map((d) => ms(d.createdAt));
    const propDates = properties.map((p) => ms(p.createdAt));
    const paid = invoices.filter((i) => i.status === 'paid');
    const paidEntries = paid.map((i) => ({ t: ms(i.paidDate || i.updatedAt), v: i.total }));

    const activeDeals = deals.filter((d) => d.stage !== 'complete');
    const newLeads = leads.filter((l) => l.status === 'new' || l.status === 'contacted');
    const shortlisted = properties.filter((p) => p.status === 'shortlisted' || p.status === 'viewed');
    const totalPaid = paid.reduce((s, i) => s + i.total, 0);

    const dl = countNew(leadDates);
    const dd = countNew(dealDates);
    const dp = countNew(propDates);
    const revThis = paidEntries.filter((e) => e.t >= weekAgo).reduce((s, e) => s + e.v, 0);
    const revLast = paidEntries.filter((e) => e.t >= twoWeeksAgo && e.t < weekAgo).reduce((s, e) => s + e.v, 0);

    const deltaLabel = (n: number, unit = '') => (n > 0 ? `+${n}${unit} this week` : n < 0 ? `${n}${unit} this week` : 'No change this week');

    const kpis: KpiDatum[] = [
      { key: 'campaigns', label: 'Active Journeys', value: activeDeals.length, icon: FileText, to: '/journeys',
        spark: weeklySeries(dealDates, now), delta: dd.thisWk - dd.lastWk, deltaLabel: deltaLabel(dd.thisWk - dd.lastWk) },
      { key: 'leads', label: 'New Leads', value: newLeads.length, icon: Users, to: '/leads',
        spark: weeklySeries(leadDates, now), delta: dl.thisWk - dl.lastWk, deltaLabel: deltaLabel(dl.thisWk - dl.lastWk) },
      { key: 'properties', label: 'Properties', value: shortlisted.length, icon: Home, to: '/properties',
        spark: weeklySeries(propDates, now), delta: dp.thisWk - dp.lastWk, deltaLabel: deltaLabel(dp.thisWk - dp.lastWk) },
      { key: 'revenue', label: 'Revenue', value: totalPaid, format: money, icon: DollarSign, to: '/journeys',
        spark: weeklySum(paidEntries, now), delta: revThis - revLast,
        deltaLabel: revThis > 0 ? `+${money(revThis)} this week` : 'No payments this week' },
    ];

    // ── Needs attention ──
    const idleLeads = leads.filter((l) => (l.status === 'new' || l.status === 'contacted') && ms(l.createdAt) < now - 3 * DAY);
    const stalledDeals = activeDeals.filter((d) => ms(d.updatedAt) < now - 7 * DAY);
    const overdueInv = invoices.filter((i) => i.status === 'overdue' || (i.status === 'sent' && i.dueDate && ms(i.dueDate) < now));
    const overdueTotal = overdueInv.reduce((s, i) => s + i.total, 0);
    const unsignedDeals = deals.filter((d) => d.agreementStatus === 'sent');
    // Clients we've signed but never raised an invoice for.
    const uninvoiced = deals.filter((d) => d.agreementStatus === 'signed' && !invoices.some((i) => i.dealId === d.id));

    const attention: AttentionItem[] = [
      idleLeads.length && { key: 'follow', label: 'Leads to follow up', count: idleLeads.length, sub: 'idle 3+ days', icon: Clock, to: '/leads' },
      stalledDeals.length && { key: 'stalled', label: 'Stalled journeys', count: stalledDeals.length, sub: 'no update 7+ days', icon: AlertTriangle, to: '/journeys' },
      overdueInv.length && { key: 'overdue', label: 'Overdue invoices', count: overdueInv.length, sub: money(overdueTotal), icon: Receipt, to: '/invoices' },
      uninvoiced.length && { key: 'uninvoiced', label: 'Signed clients not invoiced', count: uninvoiced.length, sub: 'no invoice raised', icon: DollarSign, to: '/invoices' },
      unsignedDeals.length && { key: 'agreements', label: 'Agreements awaiting signature', count: unsignedDeals.length, sub: 'sent, not signed', icon: FileSignature, to: '/journeys' },
    ].filter(Boolean) as AttentionItem[];

    // ── Pipeline funnel (active stages, value-weighted) ──
    const funnelStages = STAGE_ORDER.filter((s) => s !== 'complete');
    const counts = funnelStages.map((stage) => ({
      stage, label: STAGE_LABELS[stage],
      count: deals.filter((d) => d.stage === stage).length,
      value: deals.filter((d) => d.stage === stage).reduce((s, d) => s + d.budget, 0),
    }));
    const maxCount = Math.max(1, ...counts.map((c) => c.count));
    const funnel: FunnelStage[] = counts.map((c) => ({ ...c, pct: Math.round((c.count / maxCount) * 100) }));

    // ── Revenue series (last 6 months) ──
    const revenue: RevenuePoint[] = [];
    const base = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const start = d.getTime();
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
      const collected = paid.filter((inv) => { const t = ms(inv.paidDate || inv.updatedAt); return t >= start && t < end; }).reduce((s, inv) => s + inv.total, 0);
      const invoiced = invoices.filter((inv) => inv.status !== 'draft' && ms(inv.createdAt) >= start && ms(inv.createdAt) < end).reduce((s, inv) => s + inv.total, 0);
      revenue.push({ label: d.toLocaleString('en-NZ', { month: 'short' }), collected, invoiced });
    }

    // ── Activity feed ──
    const events: ActivityItem[] = [];
    for (const l of leads) {
      events.push({ id: `lc-${l.id}`, icon: UserPlus, text: `New lead · ${l.firstName} ${l.lastName}`, sub: l.source || 'Direct', ts: ms(l.createdAt), to: `/leads/${l.id}` });
      if (l.status === 'won') events.push({ id: `lw-${l.id}`, icon: Trophy, text: `Lead won · ${l.firstName} ${l.lastName}`, sub: money(l.budget), ts: ms(l.updatedAt), to: `/leads/${l.id}` });
    }
    for (const d of deals) {
      events.push({ id: `dc-${d.id}`, icon: ArrowRightLeft, text: `Journey · ${d.clientName}`, sub: STAGE_LABELS[d.stage], ts: ms(d.updatedAt), to: `/journeys/${d.id}` });
    }
    for (const inv of paid) {
      events.push({ id: `ip-${inv.id}`, icon: DollarSign, text: `Invoice paid · ${inv.invoiceNumber || 'Invoice'}`, sub: money(inv.total), ts: ms(inv.paidDate || inv.updatedAt), to: '/journeys' });
    }
    const activity = events.filter((e) => e.ts > 0).sort((a, b) => b.ts - a.ts).slice(0, 8);

    const hasAnyData = leads.length + deals.length + properties.length + invoices.length + agents.length > 0;
    return { kpis, attention, funnel, revenue, activity, hasAnyData };
  }, [leads, deals, properties, invoices, agents]);
}
