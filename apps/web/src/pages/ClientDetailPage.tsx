import { useState, useMemo, useRef } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useClientsStore } from '@/stores/clientsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useLeadsStore } from '@/stores/leadsStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useDocumentsStore } from '@/stores/documentsStore';
import { useConfigStore } from '@/stores/configStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/lib/permissions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Mail, Phone, Building2, FileText, Users, Edit, Check, X,
  DollarSign, ArrowRight, Search, Filter, ChevronDown, Loader2, Plug,
  Paperclip, Trash2, Eye, UploadCloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { STAGE_LABELS, STAGE_PILL } from '@/lib/statusStyles';
import { useDetailBreadcrumb } from '@/stores/breadcrumbStore';
import type { Deal, Lead, DealStage, LeadStatus, Document } from '@/types';
import { SendEmailDialog } from '@/components/SendEmailDialog';
import type { EmailRecipient } from '@/components/SendEmailDialog';
import { EmailList } from '@/components/EmailList';
import { DocumentViewer } from '@/components/DocumentViewer';
import { canDownloadDoc } from '@/lib/docAccess';
import { EntityDocuments } from '@/components/documents/EntityDocuments';
import { useEmailMessagesStore } from '@/stores/emailMessagesStore';
import { useXeroStore } from '@/stores/xeroStore';
import { pushClientToXero } from '@/lib/xero';

/** Human-readable file size, e.g. "1.4 MB". */
function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─── label / style maps ─── */

const STAGE_STYLES = STAGE_PILL;

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  agreement_sent: 'Agreement Sent',
  active: 'Active',
  won: 'Won',
  lost: 'Lost',
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: 'bg-primary/10 text-primary',
  contacted: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  qualified: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  agreement_sent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  won: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  lost: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

const ALL_STAGES = Object.keys(STAGE_LABELS) as DealStage[];
const ALL_STATUSES = Object.keys(STATUS_LABELS) as LeadStatus[];

/* ─── Dropdown helper ─── */
function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          'flex items-center gap-1.5 h-8 px-3 text-xs rounded-lg border border-border/60',
          'bg-background hover:bg-muted/50 transition-colors',
          value !== '' && 'border-primary/50 text-primary font-semibold'
        )}
      >
        <Filter className="h-3 w-3" />
        {selected ? selected.label : label}
        <ChevronDown className="h-3 w-3 ml-0.5 opacity-60" />
      </button>
      {open && (
        <div
          className="absolute top-full mt-1 left-0 z-50 min-w-[160px] bg-card border border-border/60 rounded-lg shadow-lg py-1"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            All {label}s
          </button>
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={cn(
                'w-full text-left px-3 py-1.5 text-xs hover:bg-muted/50 transition-colors',
                value === o.value && 'font-semibold text-primary'
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Linked Campaigns list ─── */
function CampaignsListSection({ deals }: { deals: Deal[] }) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return deals.filter((d) => {
      const matchesSearch =
        !q ||
        d.clientName.toLowerCase().includes(q) ||
        d.brief?.toLowerCase().includes(q) ||
        d.propertyType?.toLowerCase().includes(q) ||
        d.preferredSuburbs?.some((s) => s.toLowerCase().includes(q));
      const matchesStage = !stageFilter || d.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [deals, search, stageFilter]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Buyer Journeys
            <span className="text-muted-foreground font-normal text-sm">({deals.length})</span>
          </CardTitle>
          {deals.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="text-xs h-7">
              <Link to="/journeys">View all journeys</Link>
            </Button>
          )}
        </div>

        {deals.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaigns…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <FilterDropdown
              label="Stage"
              value={stageFilter}
              onChange={setStageFilter}
              options={ALL_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }))}
            />
            {(search || stageFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStageFilter(''); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {deals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 border border-dashed border-primary/30 mb-3">
              <FileText className="h-6 w-6 text-primary/40" />
            </div>
            <p className="text-sm font-medium">No buyer journeys yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Buyer journeys are created when a lead is marked as Won.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">No campaigns match your filters</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setStageFilter(''); }}
              className="text-xs text-primary hover:underline mt-1"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_120px_130px_36px] gap-3 px-4 py-2 bg-muted/40 border-b border-border/60">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Journey</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Budget</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Stage</span>
              <span />
            </div>
            <div className="divide-y divide-border/60">
              {filtered.map((deal) => (
                <Link
                  key={deal.id}
                  to={`/journeys/${deal.id}`}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_120px_130px_36px] gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/30 transition-colors group items-center"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {deal.brief || deal.propertyType || 'Untitled campaign'}
                    </p>
                    {deal.preferredSuburbs?.length > 0 && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {deal.preferredSuburbs.slice(0, 3).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
                      ${deal.budget.toLocaleString()} ·{' '}
                      <span className={cn('inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold', STAGE_STYLES[deal.stage])}>
                        {STAGE_LABELS[deal.stage]}
                      </span>
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-sm font-medium tabular-nums">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    {deal.budget.toLocaleString()}
                  </div>
                  <div className="hidden sm:block">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold', STAGE_STYLES[deal.stage])}>
                      {STAGE_LABELS[deal.stage]}
                    </span>
                  </div>
                  <div className="hidden sm:flex justify-end">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
                  </div>
                </Link>
              ))}
            </div>
            {filtered.length < deals.length && (
              <div className="px-4 py-2 bg-muted/20 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {deals.length} campaigns
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Linked Leads list ─── */
function LeadsListSection({ leads }: { leads: Lead[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      const matchesSearch =
        !q ||
        `${l.firstName} ${l.lastName}`.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.source?.toLowerCase().includes(q) ||
        l.propertyType?.toLowerCase().includes(q) ||
        l.preferredSuburbs?.some((s) => s.toLowerCase().includes(q));
      const matchesStatus = !statusFilter || l.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [leads, search, statusFilter]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Linked Leads
            <span className="text-muted-foreground font-normal text-sm">({leads.length})</span>
          </CardTitle>
          {leads.length > 0 && (
            <Button asChild variant="ghost" size="sm" className="text-xs h-7">
              <Link to="/leads">View all leads</Link>
            </Button>
          )}
        </div>

        {leads.length > 0 && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads…"
                className="h-8 pl-8 text-xs"
              />
            </div>
            <FilterDropdown
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            />
            {(search || statusFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatusFilter(''); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 border border-dashed border-primary/30 mb-3">
              <Users className="h-6 w-6 text-primary/40" />
            </div>
            <p className="text-sm font-medium">No linked leads</p>
            <p className="text-xs text-muted-foreground mt-1">
              Leads linked to this client will appear here.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm font-medium text-muted-foreground">No leads match your filters</p>
            <button
              type="button"
              onClick={() => { setSearch(''); setStatusFilter(''); }}
              className="text-xs text-primary hover:underline mt-1"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <div className="hidden sm:grid grid-cols-[1fr_110px_120px_100px_36px] gap-3 px-4 py-2 bg-muted/40 border-b border-border/60">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Lead</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Budget</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Source</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
              <span />
            </div>
            <div className="divide-y divide-border/60">
              {filtered.map((lead) => (
                <Link
                  key={lead.id}
                  to={`/leads/${lead.id}`}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_110px_120px_100px_36px] gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/30 transition-colors group items-center"
                >
                  <div className="min-w-0 flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                      {lead.firstName?.[0]}{lead.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {lead.firstName} {lead.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                      <div className="sm:hidden flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">${lead.budget.toLocaleString()}</span>
                        <span className={cn('inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold', STATUS_STYLES[lead.status])}>
                          {STATUS_LABELS[lead.status]}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-1 text-sm font-medium tabular-nums">
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    {lead.budget.toLocaleString()}
                  </div>
                  <div className="hidden sm:block text-sm text-muted-foreground truncate">
                    {lead.source || '—'}
                  </div>
                  <div className="hidden sm:block">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold', STATUS_STYLES[lead.status])}>
                      {STATUS_LABELS[lead.status]}
                    </span>
                  </div>
                  <div className="hidden sm:flex justify-end">
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
                  </div>
                </Link>
              ))}
            </div>
            {filtered.length < leads.length && (
              <div className="px-4 py-2 bg-muted/20 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {leads.length} leads
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Main page ─── */
export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();

  // All hooks BEFORE any early returns
  const clients = useClientsStore((s) => s.clients);
  const updateClient = useClientsStore((s) => s.updateClient);
  const deals = useDealsStore((s) => s.deals);
  const leads = useLeadsStore((s) => s.leads);
  const agents = useAgentsStore((s) => s.agents);
  const emailMessages = useEmailMessagesStore((s) => s.emails);
  const xeroConnected = useXeroStore((s) => s.connected);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncingXero, setSyncingXero] = useState(false);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [formState, setFormState] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
    tags: '',
  });

  const clientForCrumb = clients.find((c) => c.id === id);
  useDetailBreadcrumb(clientForCrumb ? `${clientForCrumb.firstName} ${clientForCrumb.lastName}`.trim() : null);

  // Guards after all hooks
  if (!id) return <Navigate to="/clients" replace />;

  const client = clients.find((c) => c.id === id);
  if (!client) return <Navigate to="/clients" replace />;

  const clientDeals = deals.filter((d) => client.dealIds.includes(d.id));
  const clientLeads = leads.filter((l) => client.leadIds.includes(l.id));
  const clientEmails = emailMessages.filter((e) => e.clientId === client.id);
  const activeDeals = clientDeals.filter((d) => d.stage !== 'complete');
  const totalBudget = clientDeals.reduce((sum, d) => sum + (d.budget || 0), 0);

  const emailRecipients: EmailRecipient[] = [
    { id: client.id, name: `${client.firstName} ${client.lastName}`, email: client.email, type: 'client' },
    ...agents.filter((a) => !!a.email).map((a) => ({
      id: a.id,
      name: `${a.firstName} ${a.lastName}`,
      email: a.email,
      type: 'agent' as const,
    })),
  ];

  const emailVariables: Record<string, string> = {
    clientName: `${client.firstName} ${client.lastName}`,
    clientEmail: client.email,
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!formState.firstName.trim() || !formState.lastName.trim() || !formState.email.trim()) {
      toast.error('First name, last name and email are required.');
      return;
    }
    setSaving(true);
    try {
      await updateClient(id, {
        firstName: formState.firstName.trim(),
        lastName: formState.lastName.trim(),
        email: formState.email.trim().toLowerCase(),
        phone: formState.phone.trim(),
        company: formState.company.trim(),
        notes: formState.notes.trim(),
        tags: formState.tags.split(',').map((t) => t.trim()).filter(Boolean),
      });
      setEditing(false);
      toast.success('Client updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update client.');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = () => {
    setFormState({
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      company: client.company,
      notes: client.notes,
      tags: client.tags.join(', '),
    });
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleSyncXero = async () => {
    setSyncingXero(true);
    try {
      const updated = await pushClientToXero(id);
      useClientsStore.setState((s) => ({
        clients: s.clients.map((c) => (c.id === id ? updated : c)),
      }));
      toast.success('Client synced to Xero.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to sync client to Xero.');
    } finally {
      setSyncingXero(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon" className="-ml-2">
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold shrink-0">
            {client.firstName[0]}{client.lastName[0]}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {client.firstName} {client.lastName}
            </h1>
            {client.company && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3.5 w-3.5" />
                {client.company}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {client.xeroContactId ? (
            <Badge variant="secondary" className="gap-1">
              <Plug className="h-3 w-3" />
              In Xero
            </Badge>
          ) : xeroConnected ? (
            <Button variant="outline" size="sm" onClick={handleSyncXero} disabled={syncingXero}>
              {syncingXero ? (
                <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Syncing…</>
              ) : (
                <><Plug className="mr-1.5 h-3.5 w-3.5" />Sync to Xero</>
              )}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEmailDialog(true)}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Send Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (editing ? handleCancelEdit() : handleStartEdit())}
          >
            {editing ? (
              <><X className="mr-1.5 h-3.5 w-3.5" />Cancel</>
            ) : (
              <><Edit className="mr-1.5 h-3.5 w-3.5" />Edit</>
            )}
          </Button>
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Journeys</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{clientDeals.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Active Journeys</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{activeDeals.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Leads</p>
            <p className="text-2xl font-bold mt-1 tabular-nums">{clientLeads.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="pt-4 pb-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Total Budget</p>
            <p className="text-xl font-bold mt-1 tabular-nums">
              {totalBudget > 0 ? `$${totalBudget.toLocaleString()}` : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Contact details */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact Details</CardTitle>
        </CardHeader>
        <CardContent>
          {editing ? (
            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fn">First name *</Label>
                  <Input
                    id="fn"
                    value={formState.firstName}
                    onChange={(e) => setFormState((f) => ({ ...f, firstName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ln">Last name *</Label>
                  <Input
                    id="ln"
                    value={formState.lastName}
                    onChange={(e) => setFormState((f) => ({ ...f, lastName: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em">Email *</Label>
                <Input
                  id="em"
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ph">Phone</Label>
                  <Input
                    id="ph"
                    value={formState.phone}
                    onChange={(e) => setFormState((f) => ({ ...f, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="co">Company</Label>
                  <Input
                    id="co"
                    value={formState.company}
                    onChange={(e) => setFormState((f) => ({ ...f, company: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tg">Tags (comma-separated)</Label>
                <Input
                  id="tg"
                  value={formState.tags}
                  onChange={(e) => setFormState((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="investor, repeat-buyer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="no">Notes</Label>
                <Textarea
                  id="no"
                  value={formState.notes}
                  onChange={(e) => setFormState((f) => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
              </div>
              <Button type="submit" size="sm" disabled={saving} className="shadow-sm shadow-primary/20">
                {saving ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="mr-1.5 h-3.5 w-3.5" /> Save Changes</>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                <a href={`mailto:${client.email}`} className="hover:text-primary transition-colors">
                  {client.email}
                </a>
                <button
                  type="button"
                  onClick={() => setShowEmailDialog(true)}
                  className="ml-auto text-xs text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <Mail className="h-3 w-3" />
                  Send email
                </button>
              </div>
              {client.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${client.phone}`} className="hover:text-primary transition-colors">
                    {client.phone}
                  </a>
                </div>
              )}
              {client.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {client.tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              {client.notes && (
                <div className="pt-2 border-t border-border/60">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{client.notes}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground pt-1">
                Client since{' '}
                {new Date(client.createdAt).toLocaleDateString('en-NZ', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <EntityDocuments entityType="client" entityId={client.id} />

      {/* Linked Outlook emails */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Emails ({clientEmails.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <EmailList emails={clientEmails} emptyText="No emails linked to this client yet. Link them from the Inbox." />
        </CardContent>
      </Card>

      {/* Linked Campaigns */}
      <CampaignsListSection deals={clientDeals} />

      {/* Linked Leads */}
      <LeadsListSection leads={clientLeads} />

      {/* Send Email Dialog */}
      <SendEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        defaultRecipient={{
          id: client.id,
          name: `${client.firstName} ${client.lastName}`,
          email: client.email,
          type: 'client',
        }}
        recipients={emailRecipients}
        variables={emailVariables}
        contextLabel={`${client.firstName} ${client.lastName}`}
      />
    </div>
  );
}