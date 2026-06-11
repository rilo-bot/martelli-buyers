import { useState, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useLeadsStore } from '@/stores/leadsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useAuthStore } from '@/stores/authStore';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { getStagePillClass, getStageDotClass } from '@/pages/SettingsPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Search, Users, ArrowRight, Phone, Mail, DollarSign, CheckCircle, LayoutGrid, List, Columns, MapPin, Bell, BarChart, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Lead, LeadStatus } from '@/types';

type ViewMode = 'card' | 'list' | 'kanban';

const STATUS_OPTIONS: LeadStatus[] = ['new', 'contacted', 'qualified', 'agreement_sent', 'active', 'won', 'lost'];

const LEAD_SOURCE_OPTIONS = [
  'Website',
  'Word of Mouth',
  'Facebook',
  'Instagram',
  'Google',
  'LinkedIn',
  'Referral',
  'Real Estate Agent',
  'Open Home',
  'Email Campaign',
  'Phone Enquiry',
  'Other',
];

interface PropertyTypeOption {
  value: string;
  label: string;
  group: 'popular' | 'standard';
}

const PROPERTY_TYPE_OPTIONS: PropertyTypeOption[] = [
  { value: 'House', label: 'House', group: 'popular' },
  { value: 'Apartment', label: 'Apartment', group: 'popular' },
  { value: 'Townhouse', label: 'Townhouse', group: 'popular' },
  { value: 'Unit', label: 'Unit', group: 'popular' },
  { value: 'Villa', label: 'Villa', group: 'standard' },
  { value: 'Terrace', label: 'Terrace', group: 'standard' },
  { value: 'Duplex', label: 'Duplex', group: 'standard' },
  { value: 'Semi-Detached', label: 'Semi-Detached', group: 'standard' },
  { value: 'Lifestyle / Rural', label: 'Lifestyle / Rural', group: 'standard' },
  { value: 'Section / Land', label: 'Section / Land', group: 'standard' },
  { value: 'Commercial', label: 'Commercial', group: 'standard' },
  { value: 'Other', label: 'Other (specify below)', group: 'standard' },
];

const STATUS_STYLES: Record<LeadStatus, { pill: string; dot: string; column: string; header: string; dropZone: string }> = {
  new: {
    pill: 'bg-primary/10 text-primary',
    dot: 'bg-primary',
    column: 'border-t-primary/60',
    header: 'bg-primary/8',
    dropZone: 'ring-2 ring-primary/40 bg-primary/5',
  },
  contacted: {
    pill: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
    dot: 'bg-cyan-500',
    column: 'border-t-cyan-400',
    header: 'bg-cyan-50 dark:bg-cyan-900/10',
    dropZone: 'ring-2 ring-cyan-400/50 bg-cyan-50/60 dark:bg-cyan-900/10',
  },
  qualified: {
    pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    dot: 'bg-violet-500',
    column: 'border-t-violet-400',
    header: 'bg-violet-50 dark:bg-violet-900/10',
    dropZone: 'ring-2 ring-violet-400/50 bg-violet-50/60 dark:bg-violet-900/10',
  },
  agreement_sent: {
    pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    dot: 'bg-amber-500',
    column: 'border-t-amber-400',
    header: 'bg-amber-50 dark:bg-amber-900/10',
    dropZone: 'ring-2 ring-amber-400/50 bg-amber-50/60 dark:bg-amber-900/10',
  },
  active: {
    pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    dot: 'bg-emerald-500',
    column: 'border-t-emerald-400',
    header: 'bg-emerald-50 dark:bg-emerald-900/10',
    dropZone: 'ring-2 ring-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-900/10',
  },
  won: {
    pill: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    dot: 'bg-green-500',
    column: 'border-t-green-400',
    header: 'bg-green-50 dark:bg-green-900/10',
    dropZone: 'ring-2 ring-green-400/50 bg-green-50/60 dark:bg-green-900/10',
  },
  lost: {
    pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    dot: 'bg-rose-500',
    column: 'border-t-rose-400',
    header: 'bg-rose-50 dark:bg-rose-900/10',
    dropZone: 'ring-2 ring-rose-400/50 bg-rose-50/60 dark:bg-rose-900/10',
  },
};

// ─── Qualification Stage Badge ──────────────────────────────────────────────
function QualStageBadge({ stageId }: { stageId: string }) {
  const stages = useQualificationStagesStore((s) => s.stages);
  const stage = useMemo(() => stages.find((s) => s.id === stageId), [stages, stageId]);
  if (!stage) return null;
  const pill = getStagePillClass(stage.color);
  const dot = getStageDotClass(stage.color);
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold', pill)}>
      <span className={cn('h-1 w-1 rounded-full shrink-0', dot)} />
      {stage.label}
    </span>
  );
}

// ─── Card View ───────────────────────────────────────────────────────────────
function CardView({ leads, onMarkWon }: { leads: Lead[]; onMarkWon: (id: string) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {leads.map((lead) => {
        const style = STATUS_STYLES[lead.status];
        return (
          <Card
            key={lead.id}
            className="group border-border/70 hover:border-primary/40 hover:shadow-md hover:shadow-primary/8 hover:-translate-y-0.5 transition-all duration-200"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary text-sm font-bold shrink-0">
                    {lead.firstName?.[0]}{lead.lastName?.[0]}
                  </div>
                  <div>
                    <CardTitle className="text-[15px] font-semibold group-hover:text-primary transition-colors">
                      {lead.firstName} {lead.lastName}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{lead.source || 'Direct enquiry'}</p>
                  </div>
                </div>
                <span className={cn('text-[11px] px-2.5 py-1 rounded-full font-semibold shrink-0', style.pill)}>
                  {lead.status.replace('_', ' ')}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {lead.qualificationStageId && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground font-medium">Stage:</span>
                  <QualStageBadge stageId={lead.qualificationStageId} />
                </div>
              )}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{lead.email}</span>
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{lead.phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5 shrink-0" />
                  <span className="font-medium text-foreground">${lead.budget.toLocaleString()}</span>
                  <span>budget</span>
                </div>
              </div>
              {lead.preferredSuburbs.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {lead.preferredSuburbs.slice(0, 3).map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs px-2 py-0.5">{s}</Badge>
                  ))}
                  {lead.preferredSuburbs.length > 3 && (
                    <Badge variant="secondary" className="text-xs px-2 py-0.5">+{lead.preferredSuburbs.length - 3}</Badge>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-1 border-t border-border/60">
                <Button asChild variant="outline" size="sm" className="flex-1 h-8 text-xs">
                  <Link to={`/leads/${lead.id}`}>
                    View <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Link>
                </Button>
                {lead.status !== 'won' && lead.status !== 'lost' && (
                  <Button size="sm" onClick={() => onMarkWon(lead.id)} className="flex-1 h-8 text-xs shadow-sm shadow-primary/20">
                    <Trophy className="mr-1.5 h-3 w-3" />
                    Mark Won
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────
function ListView({ leads, onMarkWon }: { leads: Lead[]; onMarkWon: (id: string) => void }) {
  return (
    <div className="rounded-xl border border-border/70 overflow-hidden">
      <div className="grid grid-cols-[2fr_1.5fr_1fr_1fr_1.2fr_1.4fr_auto] gap-4 px-4 py-3 bg-muted/40 border-b border-border/60 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Contact</span>
        <span>Email</span>
        <span>Budget</span>
        <span>Property</span>
        <span>Status</span>
        <span>Qual. Stage</span>
        <span className="text-right">Actions</span>
      </div>

      {leads.map((lead, i) => {
        const style = STATUS_STYLES[lead.status];
        return (
          <div
            key={lead.id}
            className={cn(
              'grid grid-cols-[2fr_1.5fr_1fr_1fr_1.2fr_1.4fr_auto] gap-4 items-center px-4 py-3.5 transition-colors hover:bg-muted/30',
              i !== leads.length - 1 && 'border-b border-border/40'
            )}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
                {lead.firstName?.[0]}{lead.lastName?.[0]}
              </div>
              <div className="min-w-0">
                <Link
                  to={`/leads/${lead.id}`}
                  className="text-sm font-medium hover:text-primary transition-colors truncate block"
                >
                  {lead.firstName} {lead.lastName}
                </Link>
                <p className="text-xs text-muted-foreground truncate">{lead.source || 'Direct enquiry'}</p>
              </div>
            </div>

            <span className="text-xs text-muted-foreground truncate">{lead.email}</span>
            <span className="text-sm font-medium tabular-nums">${lead.budget.toLocaleString()}</span>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>{lead.propertyType || '—'}</div>
              {(lead.bedrooms || lead.bathrooms) ? (
                <div className="flex items-center gap-1.5">
                  {lead.bedrooms ? <span className="flex items-center gap-0.5"><Bell className="h-3 w-3" />{lead.bedrooms}</span> : null}
                  {lead.bathrooms ? <span className="flex items-center gap-0.5"><BarChart className="h-3 w-3" />{lead.bathrooms}</span> : null}
                </div>
              ) : null}
            </div>

            <span className={cn('inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold w-fit', style.pill)}>
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', style.dot)} />
              {lead.status.replace('_', ' ')}
            </span>

            <div>
              {lead.qualificationStageId ? (
                <QualStageBadge stageId={lead.qualificationStageId} />
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button asChild variant="outline" size="sm" className="h-7 px-3 text-xs">
                <Link to={`/leads/${lead.id}`}>View</Link>
              </Button>
              {lead.status !== 'won' && lead.status !== 'lost' && (
                <Button size="sm" onClick={() => onMarkWon(lead.id)} className="h-7 px-3 text-xs shadow-sm shadow-primary/20">
                  <Trophy className="mr-1 h-3 w-3" /> Won
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Kanban View (with drag-and-drop) ────────────────────────────────────────
function KanbanView({
  leads,
  onMarkWon,
  onStatusChange,
}: {
  leads: Lead[];
  onMarkWon: (id: string) => void;
  onStatusChange: (id: string, status: LeadStatus) => void;
}) {
  const dragLeadId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<LeadStatus | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, leadId: string) => {
    dragLeadId.current = leadId;
    setDraggingId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { setDraggingId(leadId); }, 0);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragLeadId.current = null;
    setDraggingId(null);
    setDragOverStatus(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStatus(status);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as HTMLElement | null;
    const column = e.currentTarget as HTMLElement;
    if (!column.contains(related)) {
      setDragOverStatus(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    const leadId = dragLeadId.current;
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (lead && lead.status !== status) {
      onStatusChange(leadId, status);
    }
    dragLeadId.current = null;
    setDraggingId(null);
    setDragOverStatus(null);
  }, [leads, onStatusChange]);

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1">
      {STATUS_OPTIONS.map((status) => {
        const colLeads = leads.filter((l) => l.status === status);
        const style = STATUS_STYLES[status];
        const isOver = dragOverStatus === status;

        return (
          <div
            key={status}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
            className={cn(
              'flex flex-col min-w-[260px] w-[260px] rounded-xl border border-border/60 border-t-4 overflow-hidden shrink-0 transition-all duration-150',
              style.column,
              isOver && style.dropZone
            )}
          >
            <div className={cn('flex items-center justify-between px-3 py-2.5', style.header)}>
              <div className="flex items-center gap-2">
                <span className={cn('h-2 w-2 rounded-full', style.dot)} />
                <span className="text-xs font-semibold capitalize">{status.replace('_', ' ')}</span>
              </div>
              <span className="text-xs font-bold tabular-nums text-muted-foreground bg-background/60 rounded-full px-2 py-0.5">
                {colLeads.length}
              </span>
            </div>

            {isOver && (
              <div className={cn('h-0.5 w-full transition-all', style.dot)} style={{ opacity: 0.6 }} />
            )}

            <div className="flex flex-col gap-2 p-2 flex-1 overflow-y-auto max-h-[calc(100vh-22rem)]">
              {colLeads.length === 0 ? (
                <div
                  className={cn(
                    'flex flex-col items-center justify-center py-8 text-center rounded-lg border-2 border-dashed transition-all duration-150',
                    isOver ? 'border-primary/50 bg-primary/5' : 'border-border/40'
                  )}
                >
                  <span className="text-xs text-muted-foreground">
                    {isOver ? 'Drop here' : 'No leads here'}
                  </span>
                </div>
              ) : (
                colLeads.map((lead) => (
                  <KanbanCard
                    key={lead.id}
                    lead={lead}
                    isDragging={draggingId === lead.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    onMarkWon={onMarkWon}
                  />
                ))
              )}

              {colLeads.length > 0 && isOver && (
                <div className="h-10 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 flex items-center justify-center">
                  <span className="text-xs text-primary/60">Drop here</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Kanban Card ─────────────────────────────────────────────────────────────
function KanbanCard({
  lead,
  isDragging,
  onDragStart,
  onDragEnd,
  onMarkWon,
}: {
  lead: Lead;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onMarkWon: (id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, lead.id)}
      onDragEnd={onDragEnd}
      className={cn(
        'bg-card rounded-lg border border-border/60 p-3 transition-all duration-150 space-y-2.5 cursor-grab active:cursor-grabbing select-none',
        isDragging
          ? 'opacity-40 scale-95 shadow-none'
          : 'hover:border-primary/40 hover:shadow-sm hover:shadow-primary/10'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex flex-col gap-[3px] shrink-0 opacity-30 hover:opacity-60 transition-opacity">
          <div className="flex gap-[3px]">
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
          </div>
          <div className="flex gap-[3px]">
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
          </div>
          <div className="flex gap-[3px]">
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
            <span className="h-[3px] w-[3px] rounded-full bg-muted-foreground" />
          </div>
        </div>

        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary text-[11px] font-bold shrink-0">
          {lead.firstName?.[0]}{lead.lastName?.[0]}
        </div>
        <div className="min-w-0">
          <Link
            to={`/leads/${lead.id}`}
            className="text-[13px] font-semibold hover:text-primary transition-colors leading-tight block truncate"
            onClick={(e) => e.stopPropagation()}
          >
            {lead.firstName} {lead.lastName}
          </Link>
          <p className="text-[11px] text-muted-foreground truncate">{lead.source || 'Direct'}</p>
        </div>
      </div>

      {lead.qualificationStageId && (
        <div>
          <QualStageBadge stageId={lead.qualificationStageId} />
        </div>
      )}

      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <DollarSign className="h-3 w-3 shrink-0" />
          <span className="font-medium text-foreground tabular-nums">${lead.budget.toLocaleString()}</span>
        </div>
        {lead.propertyType && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{lead.propertyType}</span>
            {lead.bedrooms ? <span>· {lead.bedrooms}bd</span> : null}
            {lead.bathrooms ? <span>· {lead.bathrooms}ba</span> : null}
          </div>
        )}
        {lead.preferredSuburbs.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 opacity-0" />
            <span className="truncate">
              {lead.preferredSuburbs.slice(0, 2).join(', ')}
              {lead.preferredSuburbs.length > 2 ? ` +${lead.preferredSuburbs.length - 2}` : ''}
            </span>
          </div>
        )}
      </div>

      <div className="flex gap-1.5 pt-1 border-t border-border/50">
        <Button asChild variant="outline" size="sm" className="flex-1 h-7 text-[11px]">
          <Link to={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()}>View</Link>
        </Button>
        {lead.status !== 'won' && lead.status !== 'lost' && (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onMarkWon(lead.id); }}
            className="flex-1 h-7 text-[11px] shadow-sm shadow-primary/20"
          >
            <Trophy className="mr-1 h-3 w-3" />
            Won
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const leads = useLeadsStore((s) => s.leads);
  const addLead = useLeadsStore((s) => s.addLead);
  const updateLead = useLeadsStore((s) => s.updateLead);
  const addDeal = useDealsStore((s) => s.addDeal);
  const clients = useClientsStore((s) => s.clients);
  const addClient = useClientsStore((s) => s.addClient);
  const addDealToClient = useClientsStore((s) => s.addDealToClient);
  const addLeadToClient = useClientsStore((s) => s.addLeadToClient);
  const findClientByEmail = useClientsStore((s) => s.findClientByEmail);
  const currentUser = useAuthStore((s) => s.currentUser);
  const stages = useQualificationStagesStore((s) => s.stages);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  const [view, setView] = useState<ViewMode>('card');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  // "Mark as Won" dialog state
  const [wonLeadId, setWonLeadId] = useState<string | null>(null);
  const [wonForm, setWonForm] = useState({
    clientMode: 'new' as 'new' | 'existing',
    existingClientId: '',
  });

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', source: '', notes: '',
    budget: '', propertyTypeSelect: '', propertyTypeOther: '',
    bedrooms: '3', bathrooms: '2', preferredSuburbs: '',
    qualificationStageId: '',
  });

  const filteredLeads = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      const matchesSearch = !q || `${l.firstName} ${l.lastName} ${l.email}`.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || l.status === statusFilter;
      const matchesStage = !stageFilter || l.qualificationStageId === stageFilter;
      return matchesSearch && matchesStatus && matchesStage;
    });
  }, [leads, search, statusFilter, stageFilter]);

  const resolvedPropertyType = form.propertyTypeSelect === 'Other'
    ? form.propertyTypeOther.trim()
    : form.propertyTypeSelect;

  const popularOptions = PROPERTY_TYPE_OPTIONS.filter((o) => o.group === 'popular');
  const standardOptions = PROPERTY_TYPE_OPTIONS.filter((o) => o.group === 'standard');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error('First name, last name and email are required.');
      return;
    }
    addLead({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      source: form.source,
      status: 'new',
      qualificationStageId: form.qualificationStageId,
      notes: form.notes.trim(),
      budget: Number(form.budget) || 0,
      propertyType: resolvedPropertyType,
      bedrooms: Number(form.bedrooms) || 3,
      bathrooms: Number(form.bathrooms) || 2,
      preferredSuburbs: form.preferredSuburbs.split(',').map((s) => s.trim()).filter(Boolean),
      assignedTo: currentUser?.id ?? '',
      clientId: '',
    });
    setForm({
      firstName: '', lastName: '', email: '', phone: '', source: '', notes: '',
      budget: '', propertyTypeSelect: '', propertyTypeOther: '',
      bedrooms: '3', bathrooms: '2', preferredSuburbs: '',
      qualificationStageId: '',
    });
    setShowAddDialog(false);
  };

  const wonLead = wonLeadId ? leads.find((l) => l.id === wonLeadId) : null;

  const handleMarkWon = (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const existing = findClientByEmail(lead.email);
    setWonForm({
      clientMode: existing ? 'existing' : 'new',
      existingClientId: existing ? existing.id : '',
    });
    setWonLeadId(leadId);
  };

  const handleConfirmWon = async () => {
    if (!wonLead) return;

    let clientId = '';

    if (wonForm.clientMode === 'existing' && wonForm.existingClientId) {
      clientId = wonForm.existingClientId;
    } else {
      const newClient = await addClient({
        firstName: wonLead.firstName,
        lastName: wonLead.lastName,
        email: wonLead.email,
        phone: wonLead.phone,
        company: '',
        notes: '',
        leadIds: [wonLead.id],
        dealIds: [],
        tags: [],
        assignedTo: currentUser?.id ?? '',
      });
      clientId = newClient.id;
    }

    const deal = await addDeal({
      leadId: wonLead.id,
      clientId,
      clientName: `${wonLead.firstName} ${wonLead.lastName}`,
      clientEmail: wonLead.email,
      clientPhone: wonLead.phone,
      stage: 'qualification',
      brief: wonLead.notes,
      budget: wonLead.budget,
      fee: 0,
      feeType: 'fixed',
      preferredSuburbs: wonLead.preferredSuburbs,
      propertyType: wonLead.propertyType,
      bedrooms: wonLead.bedrooms,
      bathrooms: wonLead.bathrooms,
      agreementStatus: 'pending',
      agreementUrl: '',
      invoiceIds: [],
      assignedTo: currentUser?.id ?? '',
      aiConsentStatus: 'pending',
      aiConsentDate: '',
    });

    addDealToClient(clientId, deal.id);
    addLeadToClient(clientId, wonLead.id);
    updateLead(wonLead.id, { status: 'won', clientId });

    setWonLeadId(null);
    toast.success(
      wonForm.clientMode === 'new'
        ? 'Lead marked as Won — new client and deal created.'
        : 'Lead marked as Won — deal created and linked to existing client.'
    );
  };

  const handleKanbanStatusChange = useCallback((id: string, status: LeadStatus) => {
    if (status === 'won') {
      handleMarkWon(id);
    } else {
      updateLead(id, { status });
    }
  }, [updateLead, leads, findClientByEmail]);

  const viewButtons: { mode: ViewMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'card', icon: <LayoutGrid className="h-4 w-4" />, label: 'Card' },
    { mode: 'list', icon: <List className="h-4 w-4" />, label: 'List' },
    { mode: 'kanban', icon: <Columns className="h-4 w-4" />, label: 'Kanban' },
  ];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Pipeline</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and qualify your incoming buyer enquiries.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="shadow-md shadow-primary/25 h-10">
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Qualification stage pipeline strip */}
      {sortedStages.length > 0 && (
        <div className="flex items-center gap-0 overflow-x-auto pb-1">
          {sortedStages.map((stage, idx) => {
            const isActive = stageFilter === stage.id;
            const count = leads.filter((l) => l.qualificationStageId === stage.id).length;
            const dot = getStageDotClass(stage.color);
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setStageFilter(isActive ? '' : stage.id)}
                className={cn(
                  'relative flex items-center gap-2 px-4 py-2.5 text-xs font-semibold transition-all border-b-2 shrink-0 whitespace-nowrap',
                  isActive
                    ? 'border-primary text-primary bg-primary/5'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40'
                )}
              >
                <span className={cn('h-2 w-2 rounded-full shrink-0', dot)} />
                {stage.label}
                <span className={cn(
                  'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                )}>
                  {count}
                </span>
                {idx < sortedStages.length - 1 && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-border text-base leading-none select-none pointer-events-none">›</span>
                )}
              </button>
            );
          })}
          {stageFilter && (
            <button
              type="button"
              onClick={() => setStageFilter('')}
              className="ml-2 shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* Status summary chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
            !statusFilter
              ? 'border-primary bg-primary text-primary-foreground shadow-sm'
              : 'border-border bg-card hover:bg-muted text-muted-foreground'
          )}
        >
          All ({leads.length})
        </button>
        {STATUS_OPTIONS.map((status) => {
          const count = leads.filter((l) => l.status === status).length;
          const style = STATUS_STYLES[status];
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all border',
                statusFilter === status
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground'
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', style.dot)} />
              {status.replace('_', ' ')} ({count})
            </button>
          );
        })}
      </div>

      {/* Search + filter + view toggle */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40 h-10">
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </Select>

        {sortedStages.length > 0 && (
          <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="w-48 h-10">
            <option value="">All qual. stages</option>
            {sortedStages.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </Select>
        )}

        <div className="flex items-center rounded-lg border border-border overflow-hidden h-10 shrink-0">
          {viewButtons.map(({ mode, icon, label }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              title={label}
              className={cn(
                'flex items-center gap-1.5 px-3 h-full text-xs font-medium transition-colors',
                view === mode
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                mode !== 'card' && 'border-l border-border'
              )}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {view === 'kanban' && leads.length > 0 && (
        <p className="text-xs text-muted-foreground -mt-2">
          Drag cards between columns to update a lead's status. Drop into <strong>Won</strong> to create a client and deal.
        </p>
      )}

      {/* Content */}
      {filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/8 border-2 border-dashed border-primary/30 mb-6">
            <Users className="h-10 w-10 text-primary/40" />
          </div>
          <h3 className="text-xl font-bold">
            {statusFilter ? `No ${statusFilter.replace('_', ' ')} leads` : stageFilter ? 'No leads in this stage' : 'No leads yet'}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {statusFilter || stageFilter
              ? 'Try a different filter or clear your selection.'
              : 'Add your first buyer enquiry to start building your pipeline.'}
          </p>
          {!statusFilter && !stageFilter && (
            <Button className="mt-6 shadow-md shadow-primary/20" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first lead
            </Button>
          )}
        </div>
      ) : (
        <>
          {view === 'card' && <CardView leads={filteredLeads} onMarkWon={handleMarkWon} />}
          {view === 'list' && <ListView leads={filteredLeads} onMarkWon={handleMarkWon} />}
          {view === 'kanban' && (
            <KanbanView
              leads={filteredLeads}
              onMarkWon={handleMarkWon}
              onStatusChange={handleKanbanStatusChange}
            />
          )}
        </>
      )}

      {/* Add Lead Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First name *</Label>
                <Input id="firstName" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Jane" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last name *</Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Smith" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+64 21 xxx xxxx" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="source">Lead source</Label>
                <Select id="source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="h-10 w-full">
                  <option value="">Select a source...</option>
                  {LEAD_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </Select>
              </div>
            </div>

            {/* Qualification Stage */}
            {sortedStages.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="qualStage">Qualification stage</Label>
                <Select
                  id="qualStage"
                  value={form.qualificationStageId}
                  onChange={(e) => setForm((f) => ({ ...f, qualificationStageId: e.target.value }))}
                  className="h-10 w-full"
                >
                  <option value="">Not assigned</option>
                  {sortedStages.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input id="budget" type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} placeholder="800000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bedrooms">Beds</Label>
                <Input id="bedrooms" type="number" min="1" max="10" value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bathrooms">Baths</Label>
                <Input id="bathrooms" type="number" min="1" max="10" value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="propertyTypeSelect">Property type</Label>
              <Select
                id="propertyTypeSelect"
                value={form.propertyTypeSelect}
                onChange={(e) => setForm((f) => ({ ...f, propertyTypeSelect: e.target.value, propertyTypeOther: '' }))}
                className="h-10 w-full"
              >
                <option value="">Select a property type...</option>
                <optgroup label="— Popular —">
                  {popularOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
                <optgroup label="— More options —">
                  {standardOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              </Select>
              {form.propertyTypeSelect === 'Other' && (
                <Input
                  id="propertyTypeOther"
                  value={form.propertyTypeOther}
                  onChange={(e) => setForm((f) => ({ ...f, propertyTypeOther: e.target.value }))}
                  placeholder="Please describe the property type..."
                  className="mt-2"
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferredSuburbs">Preferred suburbs (comma-separated)</Label>
              <Input id="preferredSuburbs" value={form.preferredSuburbs} onChange={(e) => setForm((f) => ({ ...f, preferredSuburbs: e.target.value }))} placeholder="Remuera, Newmarket, Parnell" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Qualification notes..." rows={3} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
                className="shadow-sm shadow-primary/20"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mark as Won Dialog */}
      <Dialog open={!!wonLeadId} onOpenChange={(open) => { if (!open) setWonLeadId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Mark Lead as Won
            </DialogTitle>
          </DialogHeader>

          {wonLead && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Marking <strong className="text-foreground">{wonLead.firstName} {wonLead.lastName}</strong> as Won
                will create a new deal. Choose whether to link to an existing client or create a new one.
              </p>

              <div className="space-y-3">
                <Label className="text-sm font-semibold">Client record</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setWonForm((f) => ({ ...f, clientMode: 'new' }))}
                    className={cn(
                      'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all text-left',
                      wonForm.clientMode === 'new'
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      New client
                    </div>
                    <p className="text-xs mt-1 text-muted-foreground font-normal">
                      Create a new client profile from this lead
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWonForm((f) => ({ ...f, clientMode: 'existing' }))}
                    className={cn(
                      'flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all text-left',
                      wonForm.clientMode === 'existing'
                        ? 'border-primary bg-primary/8 text-primary'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted',
                      clients.length === 0 && 'opacity-50 cursor-not-allowed'
                    )}
                    disabled={clients.length === 0}
                  >
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Existing client
                    </div>
                    <p className="text-xs mt-1 text-muted-foreground font-normal">
                      Link to a client already in your CRM
                    </p>
                  </button>
                </div>

                {wonForm.clientMode === 'new' && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                    <p className="font-medium">{wonLead.firstName} {wonLead.lastName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{wonLead.email}</p>
                    {wonLead.phone && <p className="text-xs text-muted-foreground">{wonLead.phone}</p>}
                  </div>
                )}

                {wonForm.clientMode === 'existing' && clients.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="existingClient">Select existing client</Label>
                    <Select
                      id="existingClient"
                      value={wonForm.existingClientId}
                      onChange={(e) => setWonForm((f) => ({ ...f, existingClientId: e.target.value }))}
                      className="h-10 w-full"
                    >
                      <option value="">Choose a client...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName} — {c.email}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">What happens next:</p>
                <p>• Lead status → <strong>Won</strong></p>
                <p>• New deal created in <strong>Qualification</strong> stage</p>
                <p>• Deal linked to {wonForm.clientMode === 'new' ? 'a new client profile' : 'the selected client'}</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleConfirmWon}
              disabled={wonForm.clientMode === 'existing' && !wonForm.existingClientId}
              className="shadow-sm shadow-primary/20"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirm — Mark as Won
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}