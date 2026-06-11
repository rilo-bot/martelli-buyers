import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useLeadsStore } from '@/stores/leadsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Users, Home, DollarSign, Star, ArrowRight, Plus, TrendingUp,
  FileText, Building2, CheckCircle, Clock, AlertCircle, Zap,
  Activity, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGE_LABELS: Record<string, string> = {
  qualification: 'Qualification',
  search: 'Search',
  shortlisting: 'Shortlisting',
  due_diligence: 'Due Diligence',
  offer: 'Offer',
  settlement: 'Settlement',
  complete: 'Complete',
};

const STAGE_STYLES: Record<string, string> = {
  qualification: 'bg-primary/10 text-primary border-primary/20',
  search: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  shortlisting: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  due_diligence: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  offer: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  settlement: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  complete: 'bg-muted text-muted-foreground border-border',
};

const STAGE_DOT: Record<string, string> = {
  qualification: 'bg-primary',
  search: 'bg-violet-500',
  shortlisting: 'bg-amber-500',
  due_diligence: 'bg-orange-500',
  offer: 'bg-rose-500',
  settlement: 'bg-emerald-500',
  complete: 'bg-muted-foreground',
};

export default function DashboardPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const leads = useLeadsStore((s) => s.leads);
  const deals = useDealsStore((s) => s.deals);
  const properties = usePropertiesStore((s) => s.properties);
  const agents = useAgentsStore((s) => s.agents);
  const invoices = useInvoicesStore((s) => s.invoices);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = useMemo(() => currentUser?.name?.split(' ')[0] ?? 'there', [currentUser?.name]);

  const activeDeals = useMemo(() => deals.filter((d) => d.stage !== 'complete'), [deals]);
  const newLeads = useMemo(() => leads.filter((l) => l.status === 'new' || l.status === 'contacted'), [leads]);
  const preferredAgents = useMemo(() => agents.filter((a) => a.isPreferred), [agents]);
  const totalInvoiced = useMemo(() => invoices.reduce((sum, inv) => sum + inv.total, 0), [invoices]);
  const paidInvoices = useMemo(() => invoices.filter((inv) => inv.status === 'paid'), [invoices]);
  const totalPaid = useMemo(() => paidInvoices.reduce((sum, inv) => sum + inv.total, 0), [paidInvoices]);
  const overdueInvoices = useMemo(() => invoices.filter((inv) => inv.status === 'overdue'), [invoices]);

  const recentDeals = useMemo(() => [...deals].sort((a, b) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  ).slice(0, 6), [deals]);

  const recentLeads = useMemo(() => [...leads].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ).slice(0, 5), [leads]);

  const shortlistedProps = useMemo(() => properties.filter((p) => p.status === 'shortlisted' || p.status === 'inspected'), [properties]);

  const conversionRate = useMemo(() => {
    if (leads.length === 0) return 0;
    const won = leads.filter((l) => l.status === 'won').length;
    return Math.round((won / leads.length) * 100);
  }, [leads]);

  // Pipeline distribution
  const stageDistribution = useMemo(() => {
    return Object.entries(STAGE_LABELS).map(([key, label]) => ({
      stage: key,
      label,
      count: deals.filter((d) => d.stage === key).length,
    })).filter((s) => s.count > 0);
  }, [deals]);

  return (
    <div className="space-y-7">
      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl px-7 py-7 flex items-center justify-between gap-6 flex-wrap"
        style={{ background: 'linear-gradient(135deg, hsl(215 45% 11%) 0%, hsl(215 40% 15%) 50%, hsl(213 50% 18%) 100%)' }}>
        {/* Subtle accent orb */}
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(213 94% 52%), transparent 70%)', transform: 'translate(30%, -30%)' }} />
        <div className="absolute bottom-0 left-1/3 h-32 w-32 rounded-full opacity-8 pointer-events-none"
          style={{ background: 'radial-gradient(circle, hsl(174 72% 42%), transparent 70%)', transform: 'translateY(40%)' }} />

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium" style={{ color: 'hsl(210 40% 72%)' }}>CRM Dashboard</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ color: 'hsl(210 40% 96%)' }}>
            {greeting}, {firstName} 👋
          </h1>
          <p className="text-sm mt-1" style={{ color: 'hsl(210 30% 62%)' }}>
            {new Date().toLocaleDateString('en-NZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div className="flex gap-2.5 relative z-10 shrink-0">
          <Button asChild variant="outline" size="sm" className="h-9 border-border/60 hover:bg-card/20 hover:border-border"
            style={{ borderColor: 'hsl(215 30% 30%)', color: 'hsl(210 40% 85%)', background: 'hsl(215 30% 18% / 0.5)' }}>
            <Link to="/leads">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Lead
            </Link>
          </Button>
          <Button asChild size="sm" className="h-9 shadow-lg"
            style={{ background: 'linear-gradient(135deg, hsl(213 94% 48%), hsl(174 72% 42%))', border: 'none', color: '#fff' }}>
            <Link to="/deals">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New Campaign
            </Link>
          </Button>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Campaigns */}
        <Card className="kpi-card border-border/70 overflow-hidden bg-card">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
                <FileText className="h-[18px] w-[18px] text-primary" />
              </div>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border',
                deals.length === 0 ? 'bg-muted text-muted-foreground border-border' : 'bg-primary/8 text-primary border-primary/20'
              )}>
                {deals.length === 0 ? '—' : <><TrendingUp className="h-2.5 w-2.5" />{deals.length} total</>}
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Active Campaigns</p>
            <span className="text-3xl font-bold tabular-nums text-foreground">{activeDeals.length}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">{deals.length === 0 ? 'No campaigns yet' : 'active engagements'}</p>
          </CardContent>
        </Card>

        {/* New Leads */}
        <Card className="kpi-card border-border/70 overflow-hidden bg-card">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border"
                style={{ background: 'hsl(174 72% 38% / 0.10)', borderColor: 'hsl(174 72% 38% / 0.20)' }}>
                <Users className="h-[18px] w-[18px]" style={{ color: 'hsl(174 72% 38%)' }} />
              </div>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border',
                leads.length === 0 ? 'bg-muted text-muted-foreground border-border' : 'border-transparent'
              )} style={leads.length > 0 ? {
                background: 'hsl(174 72% 38% / 0.10)',
                color: 'hsl(174 72% 38%)',
                borderColor: 'hsl(174 72% 38% / 0.20)',
              } : {}}>
                {leads.length === 0 ? '—' : `${leads.length} total`}
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">New Leads</p>
            <span className="text-3xl font-bold tabular-nums text-foreground">{newLeads.length}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">{leads.length === 0 ? 'No leads yet' : 'awaiting qualification'}</p>
          </CardContent>
        </Card>

        {/* Properties */}
        <Card className="kpi-card border-border/70 overflow-hidden bg-card">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/15">
                <Home className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
              </div>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border',
                properties.length === 0 ? 'bg-muted text-muted-foreground border-border' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20'
              )}>
                {properties.length === 0 ? '—' : `${properties.length} tracked`}
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Properties</p>
            <span className="text-3xl font-bold tabular-nums text-foreground">{shortlistedProps.length}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">{properties.length === 0 ? 'No properties yet' : 'shortlisted / inspected'}</p>
          </CardContent>
        </Card>

        {/* Revenue */}
        <Card className="kpi-card border-border/70 overflow-hidden bg-card">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/15">
                <DollarSign className="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" />
              </div>
              <span className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border',
                invoices.length === 0 ? 'bg-muted text-muted-foreground border-border' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
              )}>
                {invoices.length === 0 ? '—' : `$${totalInvoiced.toLocaleString()} inv.`}
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Revenue</p>
            <span className="text-3xl font-bold tabular-nums text-foreground">${totalPaid.toLocaleString()}</span>
            <p className="mt-1 text-[11px] text-muted-foreground">{invoices.length === 0 ? 'No invoices yet' : 'collected to date'}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main 3-column grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Active Campaigns — spans 2 cols */}
        <div className="lg:col-span-2 space-y-5">
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/15">
                    <FileText className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-[14px] font-bold">Active Campaigns</CardTitle>
                    <p className="text-[11px] text-muted-foreground">Recent buyer engagements</p>
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm" className="text-primary hover:text-primary h-8 text-xs gap-1">
                  <Link to="/deals">All campaigns <ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentDeals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-4">
                    <FileText className="h-6 w-6 text-primary/40" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground">No campaigns yet</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground max-w-xs leading-relaxed">
                    Convert a qualified lead to start your first buyer campaign.
                  </p>
                  <Button asChild size="sm" className="mt-4">
                    <Link to="/leads"><Plus className="mr-1.5 h-3.5 w-3.5" />Add Lead</Link>
                  </Button>
                </div>
              ) : (
                <div>
                  {recentDeals.map((deal, i) => (
                    <Link
                      key={deal.id}
                      to={`/deals/${deal.id}`}
                      className={cn(
                        'flex items-center justify-between px-5 py-3.5 hover:bg-muted/40 transition-colors group',
                        i < recentDeals.length - 1 && 'border-b border-border/40'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/8 border border-primary/12 shrink-0">
                          <Building2 className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold truncate group-hover:text-primary transition-colors">{deal.clientName}</p>
                          <p className="text-[11px] text-muted-foreground">${deal.budget.toLocaleString()} · {deal.propertyType || 'Any type'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-bold border', STAGE_STYLES[deal.stage])}>
                          {STAGE_LABELS[deal.stage]}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity group-hover:text-primary" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pipeline Distribution */}
          {stageDistribution.length > 0 && (
            <Card className="border-border/70 shadow-sm">
              <CardHeader className="pb-3 border-b border-border/50 px-5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border">
                    <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-[14px] font-bold">Pipeline Distribution</CardTitle>
                    <p className="text-[11px] text-muted-foreground">Deals by stage</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(STAGE_LABELS).map(([stage, label]) => {
                    const count = deals.filter((d) => d.stage === stage).length;
                    return (
                      <div key={stage} className={cn(
                        'flex flex-col items-center justify-center rounded-xl p-3 border text-center',
                        STAGE_STYLES[stage]
                      )}>
                        <span className="text-xl font-bold tabular-nums">{count}</span>
                        <span className="text-[10px] font-semibold mt-0.5 leading-tight">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Recent Leads */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 px-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border"
                    style={{ background: 'hsl(174 72% 38% / 0.10)', borderColor: 'hsl(174 72% 38% / 0.20)' }}>
                    <Users className="h-3.5 w-3.5" style={{ color: 'hsl(174 72% 38%)' }} />
                  </div>
                  <CardTitle className="text-[14px] font-bold">Recent Leads</CardTitle>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary px-2">
                  <Link to="/leads"><ChevronRight className="h-3.5 w-3.5" /></Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentLeads.length === 0 ? (
                <div className="py-10 text-center px-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-dashed border-border mx-auto mb-3">
                    <Users className="h-5 w-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs text-muted-foreground">No leads yet</p>
                  <Button asChild size="sm" variant="outline" className="mt-3 h-7 text-xs">
                    <Link to="/leads"><Plus className="mr-1 h-3 w-3" />Add Lead</Link>
                  </Button>
                </div>
              ) : (
                <div>
                  {recentLeads.map((lead, i) => (
                    <Link
                      key={lead.id}
                      to={`/leads/${lead.id}`}
                      className={cn(
                        'flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors group',
                        i < recentLeads.length - 1 && 'border-b border-border/40'
                      )}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold border border-primary/15">
                        {lead.firstName?.[0]}{lead.lastName?.[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium truncate group-hover:text-primary transition-colors">{lead.firstName} {lead.lastName}</p>
                        <p className="text-[11px] text-muted-foreground truncate">${lead.budget.toLocaleString()}</p>
                      </div>
                      <Badge
                        variant={lead.status === 'new' ? 'default' : 'secondary'}
                        className="text-[10px] shrink-0 px-2 py-0.5 font-semibold"
                      >
                        {lead.status}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Stats */}
          <Card className="border-border/70 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/50 px-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted border border-border">
                  <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <CardTitle className="text-[14px] font-bold">Key Metrics</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="px-5 py-3 space-y-0">
              {[
                { icon: Star, label: 'Preferred Agents', value: preferredAgents.length, iconClass: 'text-amber-500', valueClass: '' },
                { icon: Users, label: 'Total Agents', value: agents.length, iconClass: 'text-primary', valueClass: '' },
                {
                  icon: TrendingUp,
                  label: 'Lead Conversion',
                  value: `${conversionRate}%`,
                  iconClass: 'text-emerald-500',
                  valueClass: conversionRate > 0 ? 'text-emerald-600 dark:text-emerald-400' : '',
                },
                { icon: CheckCircle, label: 'Paid Invoices', value: paidInvoices.length, iconClass: 'text-emerald-500', valueClass: '' },
                {
                  icon: AlertCircle,
                  label: 'Overdue Invoices',
                  value: overdueInvoices.length,
                  iconClass: 'text-destructive',
                  valueClass: overdueInvoices.length > 0 ? 'text-destructive' : '',
                },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center justify-between py-2.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2.5">
                    <stat.icon className={cn('h-3.5 w-3.5 shrink-0', stat.iconClass)} />
                    <span className="text-[12px] text-muted-foreground">{stat.label}</span>
                  </div>
                  <span className={cn('text-[13px] font-bold tabular-nums', stat.valueClass || 'text-foreground')}>
                    {stat.value}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-border/60" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground px-2">Quick Actions</span>
          <div className="h-px flex-1 bg-border/60" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { to: '/leads', icon: Users, label: 'Manage Leads', desc: 'Qualify and convert', gradient: 'from-primary/10 to-primary/5', iconBg: 'bg-primary/10 border-primary/15', iconColor: 'text-primary' },
            { to: '/properties', icon: Home, label: 'Properties', desc: 'Track all listings', gradient: 'from-violet-500/10 to-violet-500/5', iconBg: 'bg-violet-500/10 border-violet-500/15', iconColor: 'text-violet-600 dark:text-violet-400' },
            { to: '/agents', icon: Star, label: 'Agent Network', desc: 'View & segment agents', gradient: 'from-amber-500/10 to-amber-500/5', iconBg: 'bg-amber-500/10 border-amber-500/15', iconColor: 'text-amber-600 dark:text-amber-400' },
            { to: '/due-diligence', icon: AlertCircle, label: 'Due Diligence', desc: 'Checklists & reports', gradient: 'from-orange-500/10 to-orange-500/5', iconBg: 'bg-orange-500/10 border-orange-500/15', iconColor: 'text-orange-600 dark:text-orange-400' },
          ].map((action) => (
            <Link key={action.to} to={action.to}>
              <Card className={cn('group cursor-pointer border-border/60 card-interactive h-full bg-gradient-to-br', action.gradient, 'hover:border-primary/30')}>
                <CardHeader className="pb-2 pt-5 px-5">
                  <div className="flex items-center justify-between">
                    <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', action.iconBg)}>
                      <action.icon className={cn('h-[18px] w-[18px]', action.iconColor)} />
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-primary" />
                  </div>
                  <CardTitle className="mt-3 text-[13px] font-bold group-hover:text-primary transition-colors leading-tight">{action.label}</CardTitle>
                  <p className="text-[11px] text-muted-foreground">{action.desc}</p>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}