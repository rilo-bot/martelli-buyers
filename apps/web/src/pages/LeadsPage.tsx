import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLeadsStore } from '@/stores/leadsStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/lib/permissions';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { getStageDotClass, getStagePillClass } from '@/pages/SettingsPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Plus, Search, Users, LayoutGrid, List, Columns, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { STATUS_OPTIONS, STATUS_STYLES, type ViewMode } from '@/pages/leads/leadShared';
import { CardView } from '@/pages/leads/LeadsCards';
import { LeadsTable } from '@/pages/leads/LeadsTable';
import { KanbanView } from '@/pages/leads/LeadsKanban';
import { AddLeadDialog, WonDialog, type WonFormState, type NewLeadInput } from '@/pages/leads/LeadDialogs';
import { useWonConversion } from '@/pages/leads/useWonConversion';
import type { LeadStatus } from '@/types';

export default function LeadsPage() {
  const leads = useLeadsStore((s) => s.leads);
  const leadsLoaded = useLeadsStore((s) => s.loaded);
  const addLead = useLeadsStore((s) => s.addLead);
  const updateLead = useLeadsStore((s) => s.updateLead);
  const deleteLead = useLeadsStore((s) => s.deleteLead);
  const clients = useClientsStore((s) => s.clients);
  const findClientByEmail = useClientsStore((s) => s.findClientByEmail);
  const currentUser = useAuthStore((s) => s.currentUser);
  const stages = useQualificationStagesStore((s) => s.stages);
  const convertToWon = useWonConversion();
  const { can } = usePermissions();

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  // Filter/view state is seeded from the URL so it survives refresh and is shareable.
  const [searchParams, setSearchParams] = useSearchParams();
  const initialView = searchParams.get('view');
  const [view, setView] = useState<ViewMode>(
    initialView === 'card' || initialView === 'kanban' ? initialView : 'list',
  );
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [stageFilter, setStageFilter] = useState(searchParams.get('stage') ?? '');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [density, setDensity] = useState<'comfortable' | 'compact'>('comfortable');

  const [wonLeadId, setWonLeadId] = useState<string | null>(null);
  const [wonForm, setWonForm] = useState<WonFormState>({ clientMode: 'new', existingClientId: '' });

  // Open the add dialog when arrived via the top-bar "+ New" (/leads?new=1).
  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setShowAddDialog(true);
      searchParams.delete('new');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Keep the URL in sync with the active filters/view (bookmarkable, refresh-safe).
  useEffect(() => {
    const next = new URLSearchParams();
    if (view !== 'list') next.set('view', view);
    if (statusFilter) next.set('status', statusFilter);
    if (stageFilter) next.set('stage', stageFilter);
    if (search.trim()) next.set('q', search.trim());
    setSearchParams(next, { replace: true });
  }, [view, statusFilter, stageFilter, search, setSearchParams]);

  const debouncedSearch = useDebouncedValue(search, 200);
  const filteredLeads = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return leads.filter((l) => {
      const matchesSearch = !q || `${l.firstName} ${l.lastName} ${l.email}`.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || l.status === statusFilter;
      const matchesStage = !stageFilter || l.qualificationStageId === stageFilter;
      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [leads, debouncedSearch, statusFilter, stageFilter]);

  const handleAddLead = async (payload: NewLeadInput) => {
    await addLead(payload);
    toast.success('Lead added.');
  };

  const wonLead = wonLeadId ? leads.find((l) => l.id === wonLeadId) : null;

  const handleMarkWon = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const existing = findClientByEmail(lead.email);
    setWonForm({ clientMode: existing ? 'existing' : 'new', existingClientId: existing ? existing.id : '' });
    setWonLeadId(leadId);
  };

  const handleConfirmWon = async () => {
    if (!wonLead) return;
    try {
      const { clientCreated } = await convertToWon(wonLead, wonForm);
      setWonLeadId(null);
      toast.success(
        clientCreated
          ? 'Lead won — new client and deal created.'
          : 'Lead won — deal created and linked to existing client.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to convert lead.');
    }
  };

  const handleKanbanStatusChange = useCallback((id: string, status: LeadStatus) => {
    if (status === 'won') handleMarkWon(id);
    else updateLead(id, { status });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateLead, leads, findClientByEmail]);

  // ── Bulk actions ──
  const bulkSetStatus = (status: LeadStatus) => {
    selectedIds.forEach((id) => updateLead(id, { status }));
    toast.success(`Updated ${selectedIds.length} lead${selectedIds.length > 1 ? 's' : ''}.`);
    setSelectedIds([]);
  };
  const bulkDelete = () => {
    const n = selectedIds.length;
    selectedIds.forEach((id) => deleteLead(id));
    toast.success(`Deleted ${n} lead${n > 1 ? 's' : ''}.`);
    setSelectedIds([]);
  };

  const viewButtons: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'list', icon: <List className="h-4 w-4" />, label: 'Table' },
    { mode: 'card', icon: <LayoutGrid className="h-4 w-4" />, label: 'Cards' },
    { mode: 'kanban', icon: <Columns className="h-4 w-4" />, label: 'Board' },
  ];

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="section-eyebrow mb-1">Pipeline</p>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        </div>
        {can('leads:create') && (
          <Button onClick={() => setShowAddDialog(true)} className="h-9">
            <Plus className="mr-2 h-4 w-4" /> Add Lead
          </Button>
        )}
      </div>

      {/* Qualification stage pipeline strip — slim segmented track, tinted per stage */}
      {sortedStages.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
          {sortedStages.map((stage) => {
            const isActive = stageFilter === stage.id;
            const count = leads.filter((l) => l.qualificationStageId === stage.id).length;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setStageFilter(isActive ? '' : stage.id)}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all shrink-0 whitespace-nowrap',
                  isActive ? getStagePillClass(stage.color) : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <span className={cn('h-2 w-2 rounded-full shrink-0', getStageDotClass(stage.color))} />
                {stage.label}
                <span className={cn('rounded-full px-1.5 text-[10px] font-bold tabular-nums', isActive ? 'bg-background/50' : 'bg-muted text-muted-foreground')}>{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Toolbar: status chips (single scrollable line) + search + view toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto -mb-0.5 pb-0.5 flex-1 min-w-[220px]">
          <button type="button" onClick={() => setStatusFilter('')}
            className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border shrink-0 capitalize', !statusFilter ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted text-muted-foreground')}>
            All <span className="tabular-nums opacity-80">{leads.length}</span>
          </button>
          {STATUS_OPTIONS.map((status) => {
            const count = leads.filter((l) => l.status === status).length;
            const active = statusFilter === status;
            return (
              <button key={status} type="button" onClick={() => setStatusFilter(active ? '' : status)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all border shrink-0 capitalize', active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted text-muted-foreground')}>
                <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLES[status].dot)} />
                {status.replace('_', ' ')} <span className="tabular-nums opacity-80">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="relative w-44 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          {view === 'list' && (
            <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setDensity((d) => (d === 'comfortable' ? 'compact' : 'comfortable'))}>
              {density === 'comfortable' ? 'Compact' : 'Cozy'}
            </Button>
          )}
          <div className="flex items-center rounded-lg border border-border overflow-hidden h-9 shrink-0">
            {viewButtons.map(({ mode, icon, label }, i) => (
              <button key={mode} type="button" onClick={() => setView(mode)} title={label}
                className={cn('flex items-center gap-1.5 px-2.5 h-full text-xs font-medium transition-colors', view === mode ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground', i > 0 && 'border-l border-border')}>
                {icon}<span className="hidden lg:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bulk action bar (table view) */}
      {view === 'list' && selectedIds.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selectedIds.length} selected</span>
          <div className="flex-1" />
          <Select className="h-8 w-44 text-xs" defaultValue="" onChange={(e) => { if (e.target.value) bulkSetStatus(e.target.value as LeadStatus); }}>
            <option value="">Set status…</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-destructive hover:text-destructive" onClick={bulkDelete}>
            <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
          </Button>
          <Button variant="ghost" size="sm" className="h-8" onClick={() => setSelectedIds([])}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Content */}
      {!leadsLoaded ? (
        view === 'list'
          ? <LeadsTable leads={[]} selectedIds={[]} onSelectedChange={() => {}} density={density} onMarkWon={() => {}} loading />
          : <CardGridSkeleton />
      ) : filteredLeads.length === 0 ? (
        <EmptyState
          icon={Users}
          title={statusFilter ? `No ${statusFilter.replace('_', ' ')} leads` : stageFilter ? 'No leads in this stage' : 'No leads yet'}
          description={statusFilter || stageFilter ? 'Try a different filter or clear your selection.' : 'Add your first buyer enquiry to start building your pipeline.'}
          action={!statusFilter && !stageFilter && (
            <Button onClick={() => setShowAddDialog(true)}><Plus className="mr-2 h-4 w-4" /> Add your first lead</Button>
          )}
        />
      ) : view === 'list' ? (
        <LeadsTable leads={filteredLeads} selectedIds={selectedIds} onSelectedChange={setSelectedIds} density={density} onMarkWon={handleMarkWon} />
      ) : view === 'card' ? (
        <CardView leads={filteredLeads} onMarkWon={handleMarkWon} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground -mt-2">Drag cards between columns to update status. Drop into <strong>Won</strong> to create a client and deal.</p>
          <KanbanView leads={filteredLeads} onMarkWon={handleMarkWon} onStatusChange={handleKanbanStatusChange} />
        </>
      )}

      <AddLeadDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        sortedStages={sortedStages}
        defaultAssignedTo={currentUser?.id ?? ''}
        onSubmit={handleAddLead}
      />
      <WonDialog
        lead={wonLead ?? null}
        clients={clients}
        form={wonForm}
        onFormChange={setWonForm}
        onOpenChange={(o) => { if (!o) setWonLeadId(null); }}
        onConfirm={handleConfirmWon}
      />
    </div>
  );
}
