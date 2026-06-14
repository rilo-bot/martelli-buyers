import { useState, useMemo, useRef, useCallback } from 'react';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Plus, Pencil, Trash, GripVertical, RotateCcw, CheckCircle, AlertTriangle,
  ChevronDown, ChevronRight, ClipboardList,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { ChecklistSection } from '@/pages/settings/ChecklistSection';
import { STAGE_COLORS, BLANK_STAGE_FORM, getStagePillClass, getStageDotClass } from '@/pages/settings/stageColors';
import type { QualificationStage } from '@/types';

export function LeadSettings() {
  const stages = useQualificationStagesStore((s) => s.stages);
  const addStage = useQualificationStagesStore((s) => s.addStage);
  const updateStage = useQualificationStagesStore((s) => s.updateStage);
  const deleteStage = useQualificationStagesStore((s) => s.deleteStage);
  const reorderStages = useQualificationStagesStore((s) => s.reorderStages);
  const resetToDefaults = useQualificationStagesStore((s) => s.resetToDefaults);

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_STAGE_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const openAdd = () => { setEditingId(null); setForm(BLANK_STAGE_FORM); setDialogOpen(true); };
  const openEdit = (stage: QualificationStage) => {
    setEditingId(stage.id);
    setForm({ label: stage.label, description: stage.description, color: stage.color });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) { toast.error('Stage name is required.'); return; }
    const payload = { label: form.label.trim(), description: form.description.trim(), color: form.color };
    if (editingId) { updateStage(editingId, payload); toast.success('Stage updated.'); }
    else { addStage(payload); toast.success('Stage added.'); }
    setDialogOpen(false);
  };

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    deleteStage(deleteId);
    setDeleteId(null);
    if (expandedStageId === deleteId) setExpandedStageId(null);
    toast.success('Stage deleted.');
  }, [deleteId, deleteStage, expandedStageId]);

  const handleReset = () => {
    resetToDefaults(); setShowResetConfirm(false); setExpandedStageId(null);
    toast.success('Stages reset to defaults.');
  };

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragId.current = id; setDraggingId(id); e.dataTransfer.effectAllowed = 'move';
  }, []);
  const handleDragEnd = useCallback(() => { dragId.current = null; setDraggingId(null); setDragOver(null); }, []);
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOver(id);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragId.current;
    if (!sourceId || sourceId === targetId) { setDragOver(null); return; }
    const ordered = [...sortedStages];
    const fromIdx = ordered.findIndex((s) => s.id === sourceId);
    const toIdx = ordered.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    reorderStages(ordered.map((s) => s.id));
    dragId.current = null; setDraggingId(null); setDragOver(null);
  }, [sortedStages, reorderStages]);

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Lead Qualification Stages</CardTitle>
            <CardDescription className="mt-1 text-sm leading-relaxed">
              Define the stages a lead moves through during qualification. Each stage can have a
              configurable checklist of required items that must be completed before the lead can
              advance. Drag rows to reorder.
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowResetConfirm(true)} className="h-9 gap-1.5 text-xs text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />Reset defaults
            </Button>
            <Button size="sm" onClick={openAdd} className="h-9 gap-1.5 text-xs shadow-sm">
              <Plus className="h-3.5 w-3.5" />Add Stage
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {sortedStages.length === 0 ? (
          <EmptyState icon={CheckCircle} title="No stages configured"
            description="Add qualification stages to track leads from discovery through to signing."
            action={<Button onClick={openAdd}><Plus className="mr-2 h-4 w-4" />Add your first stage</Button>} />
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[32px_1fr_auto_auto_auto] gap-3 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span /><span>Stage</span>
              <span className="w-16 text-center">Colour</span>
              <span className="w-20 text-center">Checklist</span>
              <span className="w-16 text-right">Actions</span>
            </div>

            {sortedStages.map((stage, idx) => {
              const dot = getStageDotClass(stage.color);
              const pill = getStagePillClass(stage.color);
              const isOver = dragOver === stage.id;
              const isDragging = draggingId === stage.id;
              const isExpanded = expandedStageId === stage.id;
              const itemCount = stage.checklistItems.length;
              const requiredCount = stage.checklistItems.filter((i) => i.required).length;

              return (
                <div key={stage.id} className="overflow-hidden rounded-xl border transition-all duration-150">
                  <div
                    draggable
                    onDragStart={(e) => handleDragStart(e, stage.id)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, stage.id)}
                    onDrop={(e) => handleDrop(e, stage.id)}
                    className={cn('grid grid-cols-[32px_1fr_auto_auto_auto] items-center gap-3 px-3 py-3 transition-all duration-150',
                      isDragging ? 'scale-[0.98] border-border/40 bg-card opacity-40'
                        : isOver ? 'border-primary/60 bg-primary/5' : 'bg-card hover:bg-muted/20')}
                  >
                    <div className="flex cursor-grab items-center justify-center text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing">
                      <GripVertical className="h-4 w-4" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="w-5 text-xs font-bold tabular-nums text-muted-foreground/50">{idx + 1}.</span>
                        <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', pill)}>
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />{stage.label}
                        </span>
                      </div>
                      {stage.description && <p className="mt-1 pl-7 text-xs leading-relaxed text-muted-foreground">{stage.description}</p>}
                    </div>

                    <div className="flex w-16 justify-center"><span className={cn('h-2.5 w-2.5 rounded-full', dot)} /></div>

                    <div className="flex w-20 justify-center">
                      <button type="button" onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                        className={cn('inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
                          isExpanded ? 'bg-primary/10 text-primary'
                            : itemCount > 0 ? 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                            : 'border border-dashed border-border/50 text-muted-foreground/50 hover:border-border hover:text-muted-foreground')}>
                        <ClipboardList className="h-3 w-3" />
                        {itemCount > 0 ? <span>{itemCount}</span> : <span className="text-[10px]">Add</span>}
                        {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                    </div>

                    <div className="flex w-16 items-center justify-end gap-1">
                      <button type="button" onClick={() => openEdit(stage)} title="Edit stage"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => setDeleteId(stage.id)} title="Delete stage"
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
                        <Trash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border/40 bg-muted/20 px-4 pb-4">
                      <ChecklistSection stage={stage} />
                      {requiredCount > 0 && (
                        <p className="mt-2 flex items-center gap-1 text-[11px] text-warning">
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          {requiredCount} required item{requiredCount !== 1 ? 's' : ''} — leads must complete {requiredCount === 1 ? 'this' : 'these'} before advancing.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <p className="pl-1 pt-2 text-xs text-muted-foreground">
              Drag rows to reorder. Click the checklist icon to configure required items per stage.
            </p>
          </div>
        )}
      </CardContent>

      {/* Add / Edit stage dialog */}
      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent size="sm">
          <SheetHeader><SheetTitle>{editingId ? 'Edit Stage' : 'Add Stage'}</SheetTitle></SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="stage-label">Stage name *</Label>
              <Input id="stage-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Discovery Call" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage-desc">Description</Label>
              <Textarea id="stage-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="What happens at this stage?" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage-color">Colour</Label>
              <Select id="stage-color" value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} className="h-10 w-full">
                {STAGE_COLORS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
              <div className="flex items-center gap-2 pt-1">
                <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', getStagePillClass(form.color))}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', getStageDotClass(form.color))} />{form.label || 'Preview'}
                </span>
              </div>
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild><Button variant="ghost">Cancel</Button></SheetClose>
            <Button onClick={handleSave} disabled={!form.label.trim()}>
              <CheckCircle className="mr-2 h-4 w-4" />{editingId ? 'Save Changes' : 'Add Stage'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete stage confirm */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Delete Stage</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong className="text-foreground">{stages.find((s) => s.id === deleteId)?.label}</strong>?
            Leads currently assigned to this stage will retain their stage ID but it will no longer display in the pipeline.
            All checklist progress for this stage will be orphaned.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete}><Trash className="mr-2 h-4 w-4" />Delete Stage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirm */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5 text-primary" />Reset to Defaults</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will replace all current stages with the four default stages (each with their default checklists):{' '}
            <strong className="text-foreground">Discovery Call, In-Person Meeting, Paperwork, Signed Client</strong>.
            Any custom stages and checklist items will be removed.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button onClick={handleReset}><RotateCcw className="mr-2 h-4 w-4" />Reset Stages</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
