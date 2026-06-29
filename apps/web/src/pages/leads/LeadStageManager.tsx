import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import {
  CheckCircle, AlertTriangle, ClipboardList, ArrowRight, ArrowLeft,
  CheckSquare, Square, Lock, Check, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStagePillClass, getStageDotClass } from '@/pages/SettingsPage';
import { STATUS_STYLES } from '@/pages/leads/leadShared';
import { LEAD_STATUS_LABELS } from '@/types';
import type { QualificationStage, StageChecklistItem } from '@/types';

type StageProgress = Record<string, string[]>;

/**
 * Highest stage index a lead may move to right now. You can always move to your
 * current stage or earlier; you can only move forward through stages whose
 * required checklist items are complete (one gate at a time).
 */
function reachableMaxIndex(currentIdx: number, stages: QualificationStage[], progress: StageProgress): number {
  let max = currentIdx < 0 ? 0 : currentIdx;
  for (let k = currentIdx < 0 ? 0 : currentIdx; k < stages.length; k++) {
    const required = stages[k].checklistItems.filter((i) => i.required);
    const done = progress[stages[k].id] ?? [];
    const passed = required.every((i) => done.includes(i.id));
    if (passed) max = k + 1;
    else break;
  }
  return Math.min(max, stages.length - 1);
}

interface LeadStageManagerProps {
  currentStageId: string;
  stageProgress: StageProgress;
  sortedStages: QualificationStage[];
  onChangeStage: (stageId: string) => void;
  onToggle: (stageId: string, itemId: string) => void;
  onCompleteAll: (stageId: string, itemIds: string[]) => void;
  onClearAll: (stageId: string) => void;
}

export function LeadStageManager({
  currentStageId,
  stageProgress,
  sortedStages,
  onChangeStage,
  onToggle,
  onCompleteAll,
  onClearAll,
}: LeadStageManagerProps) {
  const [blocked, setBlocked] = useState<{ stageLabel: string; items: StageChecklistItem[] } | null>(null);

  if (sortedStages.length === 0) return null;

  const currentIdx = sortedStages.findIndex((s) => s.id === currentStageId);
  const currentStage = currentIdx >= 0 ? sortedStages[currentIdx] : null;
  const maxReachable = reachableMaxIndex(currentIdx, sortedStages, stageProgress);

  /** Attempt a stage change; enforce the gate and surface a blocked dialog. */
  const attemptStage = (targetIdx: number) => {
    if (targetIdx <= maxReachable) {
      onChangeStage(sortedStages[targetIdx].id);
      return;
    }
    const gate = sortedStages[maxReachable];
    const done = stageProgress[gate.id] ?? [];
    setBlocked({
      stageLabel: gate.label,
      items: gate.checklistItems.filter((i) => i.required && !done.includes(i.id)),
    });
  };

  return (
    <div className="space-y-5">
      {/* ── Stage stepper ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Qualification</p>
            <StageStatusInfo sortedStages={sortedStages} />
          </div>
          {currentStageId && (
            <button
              type="button"
              onClick={() => onChangeStage('')}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Clear stage
            </button>
          )}
        </div>

        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-max items-start">
            {sortedStages.map((stage, idx) => {
              const isActive = currentStageId === stage.id;
              const completedIds = stageProgress[stage.id] ?? [];
              const required = stage.checklistItems.filter((i) => i.required);
              const stageDone = required.length > 0 && required.every((i) => completedIds.includes(i.id));
              const isPast = currentIdx >= 0 && idx < currentIdx;
              const locked = idx > maxReachable;
              const done = isPast || (stageDone && !isActive);
              // The connector entering this step is "travelled" once the lead has reached it.
              const connectorReached = currentIdx >= 0 && idx <= currentIdx;
              const linked = stage.linkedStatus;

              return (
                <li key={stage.id} className="relative flex w-32 shrink-0 flex-col items-center text-center">
                  {/* connector from the previous node's centre to this one's */}
                  {idx > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-[18px] -left-1/2 -z-0 h-0.5 w-full',
                        connectorReached ? 'bg-primary' : 'bg-border',
                      )}
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => attemptStage(idx)}
                    title={locked ? 'Complete the current stage to unlock' : stage.description || stage.label}
                    aria-current={isActive ? 'step' : undefined}
                    className={cn(
                      'relative z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold transition-all',
                      isActive
                        ? cn(getStageDotClass(stage.color), 'border-transparent text-white shadow-md ring-2 ring-primary/25')
                        : done
                          ? 'border-transparent bg-emerald-500 text-white'
                          : locked
                            ? 'border-border bg-muted/40 text-muted-foreground/40'
                            : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : locked ? <Lock className="h-3.5 w-3.5" /> : idx + 1}
                  </button>

                  <span className={cn('mt-2 px-1 text-xs font-semibold leading-tight', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                    {stage.label}
                  </span>

                  {linked ? (
                    <span
                      className={cn('mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize', STATUS_STYLES[linked].pill)}
                      title={`Reaching this stage sets status → ${LEAD_STATUS_LABELS[linked]}`}
                    >
                      <span className={cn('h-1 w-1 rounded-full', STATUS_STYLES[linked].dot)} />
                      {LEAD_STATUS_LABELS[linked]}
                    </span>
                  ) : (
                    <span className="mt-1.5 text-[10px] text-muted-foreground/50">no status change</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {currentStage?.description && (
          <p className="mt-3 border-t border-border/50 pt-3 text-xs leading-relaxed text-muted-foreground">{currentStage.description}</p>
        )}
      </div>

      {/* ── Checklist + advance ────────────────────────────────────────── */}
      {currentStage && (
        <Card className="border-border/70">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center gap-2.5">
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold shrink-0', getStagePillClass(currentStage.color))}>
                <ClipboardList className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base leading-tight">Stage Checklist</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className={cn('inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-semibold text-[10px] mr-1', getStagePillClass(currentStage.color))}>
                    <span className={cn('h-1 w-1 rounded-full', getStageDotClass(currentStage.color))} />
                    {currentStage.label}
                  </span>
                  Complete required items to advance this lead.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <StageChecklist
              stage={currentStage}
              completedIds={stageProgress[currentStage.id] ?? []}
              onToggle={(itemId) => onToggle(currentStage.id, itemId)}
              onCompleteAll={(itemIds) => onCompleteAll(currentStage.id, itemIds)}
              onClearAll={() => onClearAll(currentStage.id)}
            />
            <AdvanceRow
              currentIdx={currentIdx}
              maxReachable={maxReachable}
              sortedStages={sortedStages}
              onMove={attemptStage}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Blocked dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!blocked} onOpenChange={(o) => !o && setBlocked(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Lock className="h-5 w-5" /> Stage Locked
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Complete these required items in <strong className="text-foreground">{blocked?.stageLabel}</strong> before moving further:
            </p>
            <div className="space-y-2">
              {blocked?.items.map((item) => (
                <div key={item.id} className="flex items-start gap-2.5 px-3 py-2 rounded-lg border border-amber-200/80 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{item.label}</p>
                    {item.description && <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Checklist sub-component ────────────────────────────────────────────── */

function StageChecklist({
  stage,
  completedIds,
  onToggle,
  onCompleteAll,
  onClearAll,
}: {
  stage: QualificationStage;
  completedIds: string[];
  onToggle: (itemId: string) => void;
  onCompleteAll: (itemIds: string[]) => void;
  onClearAll: () => void;
}) {
  const sortedItems = useMemo(() => [...stage.checklistItems].sort((a, b) => a.order - b.order), [stage.checklistItems]);

  if (sortedItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ClipboardList className="h-8 w-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">No checklist items configured</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Add items in <strong>Settings → Qualification Stages</strong>.</p>
      </div>
    );
  }

  const required = sortedItems.filter((i) => i.required);
  const completedRequired = required.filter((i) => completedIds.includes(i.id));
  const allRequiredDone = required.length === 0 || completedRequired.length === required.length;
  const allDone = sortedItems.every((i) => completedIds.includes(i.id));
  const dot = getStageDotClass(stage.color);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground font-medium">
            {completedIds.length} / {sortedItems.length} completed
            {required.length > 0 && <span className="ml-1.5 text-muted-foreground/70">({completedRequired.length}/{required.length} required)</span>}
          </span>
          <div className="flex gap-1.5">
            {!allDone && (
              <button type="button" onClick={() => onCompleteAll(sortedItems.map((i) => i.id))} className="text-xs text-primary underline underline-offset-2 hover:text-primary/80">
                Complete all
              </button>
            )}
            {completedIds.length > 0 && (
              <button type="button" onClick={onClearAll} className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                Clear
              </button>
            )}
          </div>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div className={cn('h-full rounded-full transition-all duration-300', dot)} style={{ width: `${(completedIds.length / sortedItems.length) * 100}%` }} />
        </div>
      </div>

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
                  : 'border-border/60 bg-card hover:border-primary/40 hover:bg-muted/30',
              )}
            >
              <span className={cn('mt-0.5 shrink-0 h-4 w-4', isDone ? 'text-emerald-500' : 'text-muted-foreground/50')}>
                {isDone ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-sm font-medium leading-snug', isDone && 'line-through text-muted-foreground')}>{item.label}</span>
                  {item.required && !isDone && (
                    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">Required</span>
                  )}
                  {isDone && (
                    <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Done</span>
                  )}
                </div>
                {item.description && <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {allRequiredDone ? (
        <div className="flex items-center gap-2.5 p-3 rounded-lg border border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-800/40 dark:bg-emerald-900/10">
          <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            {required.length > 0 ? 'All required items complete — ready to advance.' : 'No required items — ready to advance.'}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200/80 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/10">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-amber-700 dark:text-amber-300">
              {completedRequired.length === 0 ? 'Stage not started' : `${required.length - completedRequired.length} required item${required.length - completedRequired.length === 1 ? '' : 's'} remaining`}
            </p>
            <p className="text-amber-600/80 dark:text-amber-400/70 mt-0.5">Complete all required items before advancing.</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Advance / back row ─────────────────────────────────────────────────── */

function AdvanceRow({
  currentIdx,
  maxReachable,
  sortedStages,
  onMove,
}: {
  currentIdx: number;
  maxReachable: number;
  sortedStages: QualificationStage[];
  onMove: (targetIdx: number) => void;
}) {
  const nextStage = currentIdx < sortedStages.length - 1 ? sortedStages[currentIdx + 1] : null;
  const prevStage = currentIdx > 0 ? sortedStages[currentIdx - 1] : null;
  const canAdvance = nextStage ? currentIdx + 1 <= maxReachable : false;

  return (
    <div className="flex items-center justify-between gap-3 pt-2 border-t border-border/50 flex-wrap">
      {prevStage ? (
        <button
          type="button"
          onClick={() => onMove(currentIdx - 1)}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
        >
          <ArrowLeft className="h-3 w-3" /> Back to{' '}
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px]', getStagePillClass(prevStage.color))}>
            <span className={cn('h-1 w-1 rounded-full', getStageDotClass(prevStage.color))} />
            {prevStage.label}
          </span>
        </button>
      ) : (
        <div />
      )}

      {nextStage ? (
        <button
          type="button"
          onClick={() => onMove(currentIdx + 1)}
          className={cn(
            'flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all',
            canAdvance
              ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm shadow-primary/20'
              : 'border-border bg-card text-muted-foreground hover:bg-muted',
          )}
        >
          {!canAdvance && <Lock className="h-3 w-3 shrink-0" />}
          Advance to{' '}
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold text-[10px]', getStagePillClass(nextStage.color))}>
            <span className={cn('h-1 w-1 rounded-full', getStageDotClass(nextStage.color))} />
            {nextStage.label}
          </span>
          {canAdvance && <ArrowRight className="h-3 w-3 shrink-0" />}
        </button>
      ) : (
        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
          <CheckCircle className="h-4 w-4" /> Final stage reached
        </span>
      )}
    </div>
  );
}

/* ─── Stage → status connection popover ──────────────────────────────────── */

/**
 * Small "how does this work?" popover explaining the one-way stage→status link.
 * Lists every stage and the pipeline status it sets on arrival. No popover
 * primitive in the kit, so this is a self-contained button + click-away panel.
 */
function StageStatusInfo({ sortedStages }: { sortedStages: QualificationStage[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="How qualification stages connect to lead status"
        aria-expanded={open}
        className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
      >
        <Info className="h-3.5 w-3.5" />
      </button>

      {open && (
        <>
          {/* click-away catcher */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            role="dialog"
            className="absolute left-0 top-7 z-50 w-72 rounded-xl border border-border bg-card p-3.5 shadow-lg"
          >
            <p className="text-xs font-semibold text-foreground">How stages connect to status</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              When a lead reaches a stage, its pipeline status updates automatically — so the
              stage checklist is the single thing you drive.
            </p>

            <div className="mt-3 space-y-1.5">
              {sortedStages.map((stage) => (
                <div key={stage.id} className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium">
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', getStageDotClass(stage.color))} />
                    <span className="truncate">{stage.label}</span>
                  </span>
                  {stage.linkedStatus ? (
                    <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                      <ArrowRight className="h-3 w-3" />
                      <span className={cn('inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold capitalize', STATUS_STYLES[stage.linkedStatus].pill)}>
                        {LEAD_STATUS_LABELS[stage.linkedStatus]}
                      </span>
                    </span>
                  ) : (
                    <span className="shrink-0 text-[10px] text-muted-foreground/50">no change</span>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-3 border-t border-border/60 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">
              <span className="font-semibold text-foreground">Won</span> and{' '}
              <span className="font-semibold text-foreground">Lost</span> are always set manually —
              winning a lead creates the client &amp; deal.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
