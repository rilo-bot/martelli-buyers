import { useState, useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useLeadsStore } from '@/stores/leadsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useAuthStore } from '@/stores/authStore';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { getStagePillClass, getStageDotClass } from '@/pages/SettingsPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  ArrowLeft, CheckCircle, Phone, Mail, DollarSign, MapPin, Trophy,
  Plus, Users, ChevronRight, AlertTriangle, ClipboardList, ArrowRight,
  Circle, CheckSquare, Square, Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { LeadStatus, QualificationStage, StageChecklistItem } from '@/types';

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

// ─── Stage Checklist Panel ───────────────────────────────────────────────────

interface StageChecklistPanelProps {
  leadId: string;
  stage: QualificationStage;
  completedIds: string[];
  onToggle: (itemId: string) => void;
  onCompleteAll: (itemIds: string[]) => void;
  onClearAll: () => void;
}

function StageChecklistPanel({
  leadId,
  stage,
  completedIds,
  onToggle,
  onCompleteAll,
  onClearAll,
}: StageChecklistPanelProps) {
  const sortedItems = useMemo(
    () => [...stage.checklistItems].sort((a, b) => a.order - b.order),
    [stage.checklistItems]
  );

  if (sortedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No checklist items configured</p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          Add items to this stage in <strong>Settings → Qualification Stages</strong>.
        </p>
      </div>
    );
  }

  const requiredItems = sortedItems.filter((i) => i.required);
  const completedRequired = requiredItems.filter((i) => completedIds.includes(i.id));
  const allRequiredDone = requiredItems.length === 0 || completedRequired.length === requiredItems.length;
  const allDone = sortedItems.every((i) => completedIds.includes(i.id));
  const dot = getStageDotClass(stage.color);

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            {completedIds.length} / {sortedItems.length} completed
            {requiredItems.length > 0 && (
              <span className="ml-1.5 text-muted-foreground/70">
                ({completedRequired.length}/{requiredItems.length} required)
              </span>
            )}
          </span>
          <div className="flex gap-1.5">
            {!allDone && (
              <button
                type="button"
                onClick={() => onCompleteAll(sortedItems.map((i) => i.id))}
                className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
              >
                Complete all
              </button>
            )}
            {completedIds.length > 0 && (
              <button
                type="button"
                onClick={onClearAll}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', dot)}
            style={{ width: `${sortedItems.length > 0 ? (completedIds.length / sortedItems.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Checklist items */}
      <div className="space-y-1.5">
        {sortedItems.map((item) => {
          const isDone = completedIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                'w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all duration-150',
                isDone
                  ? 'border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-900/10'
                  : 'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30'
              )}
            >
              <span className={cn('mt-0.5 shrink-0 h-4 w-4', isDone ? 'text-emerald-500' : 'text-muted-foreground/50')}>
                {isDone ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-sm font-medium leading-snug', isDone && 'line-through text-muted-foreground')}>
                    {item.label}
                  </span>
                  {item.required && !isDone && (
                    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Required
                    </span>
                  )}
                  {isDone && (
                    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                      Done
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Validation result */}
      {!allRequiredDone && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200/80 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-700 dark:text-amber-300">
              {completedRequired.length === 0
                ? 'Stage not started'
                : `${requiredItems.length - completedRequired.length} required item${requiredItems.length - completedRequired.length === 1 ? '' : 's'} remaining`}
            </p>
            <p className="text-amber-600/80 dark:text-amber-400/70 mt-0.5">
              Complete all required items before advancing to the next stage.
            </p>
          </div>
        </div>
      )}

      {allRequiredDone && (
        <div className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {requiredItems.length > 0 ? 'All required items complete — ready to advance.' : 'No required items — ready to advance.'}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Stage Advance Section ───────────────────────────────────────────────────

interface StageAdvanceSectionProps {
  leadId: string;
  currentStageId: string;
  sortedStages: QualificationStage[];
  stageProgress: Record<string, string[]>;
  onAdvance: (nextStageId: string) => void;
}

function StageAdvanceSection({
  leadId,
  currentStageId,
  sortedStages,
  stageProgress,
  onAdvance,
}: StageAdvanceSectionProps) {
  const currentIdx = sortedStages.findIndex((s) => s.id === currentStageId);
  const nextStage = currentIdx >= 0 && currentIdx < sortedStages.length - 1
    ? sortedStages[currentIdx + 1]
    : null;
  const prevStage = currentIdx > 0 ? sortedStages[currentIdx - 1] : null;
  const currentStage = sortedStages[currentIdx];

  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const [blockedItems, setBlockedItems] = useState<StageChecklistItem[]>([]);

  if (!currentStage) return null;

  const completedIds = stageProgress[currentStageId] ?? [];
  const requiredItems = currentStage.checklistItems.filter((i) => i.required);
  const incompleteRequired = requiredItems.filter((i) => !completedIds.includes(i.id));
  const canAdvance = incompleteRequired.length === 0;

  const handleAdvanceClick = () => {
    if (!nextStage) return;
    if (!canAdvance) {
      setBlockedItems(incompleteRequired);
      setShowBlockedDialog(true);
      return;
    }
    onAdvance(nextStage.id);
  };

  const nextPill = nextStage ? getStagePillClass(nextStage.color) : '';
  const nextDot = nextStage ? getStageDotClass(nextStage.color) : '';
  const prevPill = prevStage ? getStagePillClass(prevStage.color) : '';
  const prevDot = prevStage ? getStageDotClass(prevStage.color) : '';

  return (
    <>
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50 flex-wrap">
        {prevStage ? (
          <button
            type="button"
            onClick={() => onAdvance(prevStage.id)}
            className={cn(
              'flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all',
              'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <ArrowLeft className="h-3 w-3" />
            Back to{' '}
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px]', prevPill)}>
              <span className={cn('h-1 w-1 rounded-full', prevDot)} />
              {prevStage.label}
            </span>
          </button>
        ) : (
          <div />
        )}

        {nextStage && (
          <button
            type="button"
            onClick={handleAdvanceClick}
            className={cn(
              'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all',
              canAdvance
                ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20'
                : 'border-border bg-card text-muted-foreground hover:bg-muted cursor-not-allowed'
            )}
          >
            {!canAdvance && <Lock className="h-3 w-3 shrink-0" />}
            Advance to{' '}
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px]', nextPill)}>
              <span className={cn('h-1 w-1 rounded-full', nextDot)} />
              {nextStage.label}
            </span>
            {canAdvance && <ArrowRight className="h-3 w-3 shrink-0" />}
          </button>
        )}

        {!nextStage && currentIdx === sortedStages.length - 1 && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
            <CheckCircle className="h-4 w-4" />
            Final stage reached
          </span>
        )}
      </div>

      {/* Blocked dialog */}
      <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Lock className="h-5 w-5" />
              Stage Advance Blocked
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The following required items must be completed before this lead can advance to{' '}
              <strong className="text-foreground">{nextStage?.label}</strong>:
            </p>
            <div className="space-y-2">
              {blockedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-amber-200/80 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Tick each item in the checklist above when complete, then try advancing again.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/leads" replace />;

  const lead = useLeadsStore((s) => s.leads.find((l) => l.id === id));
  const updateLead = useLeadsStore((s) => s.updateLead);
  const toggleStageChecklistItem = useLeadsStore((s) => s.toggleStageChecklistItem);
  const completeAllStageItems = useLeadsStore((s) => s.completeAllStageItems);
  const clearStageProgress = useLeadsStore((s) => s.clearStageProgress);
  const addDeal = useDealsStore((s) => s.addDeal);
  const clients = useClientsStore((s) => s.clients);
  const addClient = useClientsStore((s) => s.addClient);
  const addDealToClient = useClientsStore((s) => s.addDealToClient);
  const addLeadToClient = useClientsStore((s) => s.addLeadToClient);
  const findClientByEmail = useClientsStore((s) => s.findClientByEmail);
  const currentUser = useAuthStore((s) => s.currentUser);
  const stages = useQualificationStagesStore((s) => s.stages);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  const [showWonDialog, setShowWonDialog] = useState(false);
  const [wonForm, setWonForm] = useState({
    clientMode: 'new' as 'new' | 'existing',
    existingClientId: '',
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    firstName: lead?.firstName ?? '',
    lastName: lead?.lastName ?? '',
    email: lead?.email ?? '',
    phone: lead?.phone ?? '',
    source: lead?.source ?? '',
    notes: lead?.notes ?? '',
    budget: String(lead?.budget ?? ''),
    propertyType: lead?.propertyType ?? '',
    bedrooms: String(lead?.bedrooms ?? 3),
    bathrooms: String(lead?.bathrooms ?? 2),
    preferredSuburbs: lead?.preferredSuburbs?.join(', ') ?? '',
    qualificationStageId: lead?.qualificationStageId ?? '',
  });

  if (!lead) return <Navigate to="/leads" replace />;

  const linkedClient = lead.clientId
    ? clients.find((c) => c.id === lead.clientId)
    : null;

  const currentStage = sortedStages.find((s) => s.id === lead.qualificationStageId);
  const stageProgress = lead.stageProgress ?? {};

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateLead(id, {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      source: form.source,
      notes: form.notes.trim(),
      budget: Number(form.budget) || 0,
      propertyType: form.propertyType.trim(),
      bedrooms: Number(form.bedrooms) || 3,
      bathrooms: Number(form.bathrooms) || 2,
      preferredSuburbs: form.preferredSuburbs.split(',').map((s) => s.trim()).filter(Boolean),
      qualificationStageId: form.qualificationStageId,
    });
    setEditing(false);
    toast.success('Lead updated.');
  };

  const openWonDialog = () => {
    const existing = findClientByEmail(lead.email);
    setWonForm({
      clientMode: existing ? 'existing' : 'new',
      existingClientId: existing ? existing.id : '',
    });
    setShowWonDialog(true);
  };

  const handleConfirmWon = async () => {
    let clientId = '';

    if (wonForm.clientMode === 'existing' && wonForm.existingClientId) {
      clientId = wonForm.existingClientId;
    } else {
      const newClient = await addClient({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        company: '',
        notes: '',
        leadIds: [lead.id],
        dealIds: [],
        tags: [],
        assignedTo: currentUser?.id ?? '',
      });
      clientId = newClient.id;
    }

    const deal = await addDeal({
      leadId: id,
      clientId,
      clientName: `${lead.firstName} ${lead.lastName}`,
      clientEmail: lead.email,
      clientPhone: lead.phone,
      stage: 'qualification',
      brief: lead.notes,
      budget: lead.budget,
      fee: 0,
      feeType: 'fixed',
      preferredSuburbs: lead.preferredSuburbs,
      propertyType: lead.propertyType,
      bedrooms: lead.bedrooms,
      bathrooms: lead.bathrooms,
      agreementStatus: 'pending',
      agreementUrl: '',
      invoiceIds: [],
      assignedTo: currentUser?.id ?? '',
      aiConsentStatus: 'pending',
      aiConsentDate: '',
    });

    addDealToClient(clientId, deal.id);
    addLeadToClient(clientId, lead.id);
    updateLead(id, { status: 'won', clientId });

    setShowWonDialog(false);
    toast.success(
      wonForm.clientMode === 'new'
        ? 'Lead won — new client and deal created.'
        : 'Lead won — deal created and linked to existing client.'
    );
  };

  const handleAdvanceToStage = (nextStageId: string) => {
    const nextStage = sortedStages.find((s) => s.id === nextStageId);
    updateLead(id, { qualificationStageId: nextStageId });
    toast.success(`Stage updated to "${nextStage?.label ?? nextStageId}".`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Button asChild variant="ghost" size="icon" className="-ml-2">
          <Link to="/leads"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{lead.firstName} {lead.lastName}</h1>
          <p className="text-sm text-muted-foreground">Lead · {lead.source || 'Direct enquiry'}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select
            value={lead.status}
            onChange={(e) => {
              const newStatus = e.target.value as LeadStatus;
              if (newStatus === 'won') {
                openWonDialog();
              } else {
                updateLead(id, { status: newStatus });
              }
            }}
            className="w-36 text-sm"
          >
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
          {lead.status !== 'won' && lead.status !== 'lost' && (
            <Button size="sm" onClick={openWonDialog} className="shadow-sm shadow-primary/20">
              <Trophy className="mr-1.5 h-3.5 w-3.5" />
              Mark as Won
            </Button>
          )}
        </div>
      </div>

      {/* Qualification stage pipeline track */}
      {sortedStages.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-card p-4">
          <div className="flex items-center gap-1 flex-wrap">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mr-2">Qual. Stage</p>
            {sortedStages.map((stage, idx) => {
              const isActive = lead.qualificationStageId === stage.id;
              const pill = getStagePillClass(stage.color);
              const dot = getStageDotClass(stage.color);
              const completedIds = stageProgress[stage.id] ?? [];
              const requiredItems = stage.checklistItems.filter((i) => i.required);
              const completedRequired = requiredItems.filter((i) => completedIds.includes(i.id));
              const stageDone = requiredItems.length > 0 && completedRequired.length === requiredItems.length;
              const stageStarted = completedIds.length > 0;
              return (
                <div key={stage.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => updateLead(id, { qualificationStageId: stage.id })}
                    className={cn(
                      'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold transition-all border',
                      isActive
                        ? cn(pill, 'ring-2 ring-offset-1 ring-current')
                        : 'border-border bg-card text-muted-foreground hover:bg-muted'
                    )}
                    title={stage.description || stage.label}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', isActive ? dot : 'bg-muted-foreground/40')} />
                    {stage.label}
                    {stageDone && (
                      <CheckCircle className="h-3 w-3 ml-0.5 text-emerald-500" />
                    )}
                    {stageStarted && !stageDone && stage.checklistItems.length > 0 && (
                      <Circle className="h-3 w-3 ml-0.5 text-amber-400" />
                    )}
                  </button>
                  {idx < sortedStages.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                  )}
                </div>
              );
            })}
            {lead.qualificationStageId && (
              <button
                type="button"
                onClick={() => updateLead(id, { qualificationStageId: '' })}
                className="ml-2 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>
          {currentStage?.description && (
            <p className="text-xs text-muted-foreground mt-2 pl-0.5 leading-relaxed">{currentStage.description}</p>
          )}
        </div>
      )}

      {/* Stage Checklist + Advance */}
      {currentStage && (
        <Card className="border-border/70">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0',
                  getStagePillClass(currentStage.color)
                )}>
                  <ClipboardList className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-base leading-tight">Stage Checklist</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold text-[10px] mr-1',
                      getStagePillClass(currentStage.color)
                    )}>
                      <span className={cn('h-1 w-1 rounded-full', getStageDotClass(currentStage.color))} />
                      {currentStage.label}
                    </span>
                    Complete required items to advance this lead.
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <StageChecklistPanel
              leadId={id}
              stage={currentStage}
              completedIds={stageProgress[currentStage.id] ?? []}
              onToggle={(itemId) => toggleStageChecklistItem(id, currentStage.id, itemId)}
              onCompleteAll={(itemIds) => completeAllStageItems(id, currentStage.id, itemIds)}
              onClearAll={() => clearStageProgress(id, currentStage.id)}
            />
            <StageAdvanceSection
              leadId={id}
              currentStageId={currentStage.id}
              sortedStages={sortedStages}
              stageProgress={stageProgress}
              onAdvance={handleAdvanceToStage}
            />
          </CardContent>
        </Card>
      )}

      {/* Linked client banner */}
      {linkedClient && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs font-bold shrink-0">
            {linkedClient.firstName[0]}{linkedClient.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{linkedClient.firstName} {linkedClient.lastName}</p>
            <p className="text-xs text-muted-foreground">Linked client profile</p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs shrink-0">
            <Link to={`/clients/${linkedClient.id}`}>View Client</Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Contact Details</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
                {editing ? 'Cancel' : 'Edit'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fn">First name</Label>
                    <Input id="fn" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ln">Last name</Label>
                    <Input id="ln" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em">Email</Label>
                  <Input id="em" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ph">Phone</Label>
                  <Input id="ph" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="src">Lead source</Label>
                  <Select id="src" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="h-10 w-full">
                    <option value="">Select a source...</option>
                    {LEAD_SOURCE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                </div>
                {sortedStages.length > 0 && (
                  <div className="space-y-1.5">
                    <Label htmlFor="qualStageEdit">Qualification stage</Label>
                    <Select
                      id="qualStageEdit"
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
                <Button type="submit" size="sm">Save Changes</Button>
              </form>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />{lead.email}
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />{lead.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />Budget: ${lead.budget.toLocaleString()}
                </div>
                {lead.preferredSuburbs.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{lead.preferredSuburbs.join(', ')}
                  </div>
                )}
                <div className="pt-2 border-t border-border/60 flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={lead.status === 'won' ? 'default' : lead.status === 'lost' ? 'destructive' : 'secondary'}
                    className="text-xs"
                  >
                    {lead.status.replace('_', ' ')}
                  </Badge>
                  {currentStage && (
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold',
                      getStagePillClass(currentStage.color)
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', getStageDotClass(currentStage.color))} />
                      {currentStage.label}
                    </span>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Property Requirements</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="budget">Budget ($)</Label>
                  <Input id="budget" type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pt">Property type</Label>
                  <Input id="pt" value={form.propertyType} onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="beds">Beds</Label>
                    <Input id="beds" type="number" value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="baths">Baths</Label>
                    <Input id="baths" type="number" value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subs">Preferred suburbs</Label>
                  <Input id="subs" value={form.preferredSuburbs} onChange={(e) => setForm((f) => ({ ...f, preferredSuburbs: e.target.value }))} placeholder="Comma-separated" />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Budget</p>
                    <p className="font-semibold">${lead.budget.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                    <p className="font-semibold">{lead.propertyType || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Bedrooms</p>
                    <p className="font-semibold">{lead.bedrooms}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Bathrooms</p>
                    <p className="font-semibold">{lead.bathrooms}</p>
                  </div>
                </div>
                {lead.preferredSuburbs.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Preferred Suburbs</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {lead.preferredSuburbs.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Qualification Notes</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={4} placeholder="Notes from qualification call..." />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed">{lead.notes || 'No notes recorded.'}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mark as Won dialog */}
      <Dialog open={showWonDialog} onOpenChange={setShowWonDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              Mark Lead as Won
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Marking <strong className="text-foreground">{lead.firstName} {lead.lastName}</strong> as Won
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
                  <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{lead.email}</p>
                  {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
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