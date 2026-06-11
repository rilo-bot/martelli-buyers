import { useState, useMemo, useRef, useCallback } from 'react';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select } from '@/components/ui/select';
import {
  Plus, Pencil, Trash, GripVertical, RotateCcw, CheckCircle,
  AlertTriangle, ChevronDown, ChevronRight, ClipboardList, CheckSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { QualificationStage, StageChecklistItem } from '@/types';

const STAGE_COLORS = [
  { value: 'cyan', label: 'Cyan', dot: 'bg-cyan-500', pill: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  { value: 'violet', label: 'Violet', dot: 'bg-violet-500', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { value: 'amber', label: 'Amber', dot: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'emerald', label: 'Emerald', dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'rose', label: 'Rose', dot: 'bg-rose-500', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  { value: 'primary', label: 'Brand', dot: 'bg-primary', pill: 'bg-primary/10 text-primary' },
  { value: 'orange', label: 'Orange', dot: 'bg-orange-500', pill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'sky', label: 'Sky', dot: 'bg-sky-500', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
];

export function getStagePillClass(color: string): string {
  return STAGE_COLORS.find((c) => c.value === color)?.pill ?? 'bg-muted text-muted-foreground';
}

export function getStageDotClass(color: string): string {
  return STAGE_COLORS.find((c) => c.value === color)?.dot ?? 'bg-muted-foreground';
}

const BLANK_STAGE_FORM = { label: '', description: '', color: 'cyan' };
const BLANK_CHECKLIST_FORM = { label: '', description: '', required: true };

// ─── Checklist Item Editor (per stage) ───────────────────────────────────────

interface ChecklistSectionProps {
  stage: QualificationStage;
}

function ChecklistSection({ stage }: ChecklistSectionProps) {
  const addChecklistItem = useQualificationStagesStore((s) => s.addChecklistItem);
  const updateChecklistItem = useQualificationStagesStore((s) => s.updateChecklistItem);
  const deleteChecklistItem = useQualificationStagesStore((s) => s.deleteChecklistItem);
  const reorderChecklistItems = useQualificationStagesStore((s) => s.reorderChecklistItems);

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_CHECKLIST_FORM);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Drag state for checklist reorder
  const dragItemId = useRef<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => [...stage.checklistItems].sort((a, b) => a.order - b.order),
    [stage.checklistItems]
  );

  const openAdd = () => {
    setEditId(null);
    setForm(BLANK_CHECKLIST_FORM);
    setAddOpen(true);
  };

  const openEdit = (item: StageChecklistItem) => {
    setEditId(item.id);
    setForm({ label: item.label, description: item.description, required: item.required });
    setAddOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) {
      toast.error('Item label is required.');
      return;
    }
    if (editId) {
      updateChecklistItem(stage.id, editId, {
        label: form.label.trim(),
        description: form.description.trim(),
        required: form.required,
      });
      toast.success('Checklist item updated.');
    } else {
      addChecklistItem(stage.id, {
        label: form.label.trim(),
        description: form.description.trim(),
        required: form.required,
      });
      toast.success('Checklist item added.');
    }
    setAddOpen(false);
  };

  const handleDelete = useCallback(() => {
    if (!deleteItemId) return;
    deleteChecklistItem(stage.id, deleteItemId);
    setDeleteItemId(null);
    toast.success('Checklist item removed.');
  }, [deleteItemId, stage.id, deleteChecklistItem]);

  const handleItemDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    dragItemId.current = itemId;
    setDraggingItemId(itemId);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleItemDragEnd = useCallback(() => {
    dragItemId.current = null;
    setDraggingItemId(null);
    setDragOverItemId(null);
  }, []);

  const handleItemDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItemId(itemId);
  }, []);

  const handleItemDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragItemId.current;
    if (!sourceId || sourceId === targetId) {
      setDragOverItemId(null);
      return;
    }
    const ordered = [...sortedItems];
    const fromIdx = ordered.findIndex((i) => i.id === sourceId);
    const toIdx = ordered.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    reorderChecklistItems(stage.id, ordered.map((i) => i.id));
    dragItemId.current = null;
    setDraggingItemId(null);
    setDragOverItemId(null);
  }, [sortedItems, stage.id, reorderChecklistItems]);

  const requiredCount = sortedItems.filter((i) => i.required).length;

  return (
    <div className="mt-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Checklist ({sortedItems.length} item{sortedItems.length !== 1 ? 's' : ''}{requiredCount > 0 ? `, ${requiredCount} required` : ''})
          </span>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add item
        </button>
      </div>

      {sortedItems.length === 0 ? (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border/50 bg-muted/20">
          <span className="text-xs text-muted-foreground/70">
            No checklist items — leads can advance freely between stages.
          </span>
          <button
            type="button"
            onClick={openAdd}
            className="ml-auto text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors shrink-0"
          >
            Add one
          </button>
        </div>
      ) : (
        <div className="space-y-1">
          {sortedItems.map((item) => {
            const isOver = dragOverItemId === item.id;
            const isDragging = draggingItemId === item.id;
            return (
              <div
                key={item.id}
                draggable
                onDragStart={(e) => handleItemDragStart(e, item.id)}
                onDragEnd={handleItemDragEnd}
                onDragOver={(e) => handleItemDragOver(e, item.id)}
                onDrop={(e) => handleItemDrop(e, item.id)}
                className={cn(
                  'flex items-start gap-2.5 px-3 py-2 rounded-lg border transition-all duration-150',
                  isDragging
                    ? 'opacity-40 scale-[0.98] border-border/40 bg-card'
                    : isOver
                    ? 'border-primary/60 bg-primary/5'
                    : 'border-border/40 bg-card hover:border-border/70'
                )}
              >
                <div
                  className="mt-0.5 cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors shrink-0"
                >
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
                <CheckSquare className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', item.required ? 'text-amber-500' : 'text-muted-foreground/40')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium">{item.label}</span>
                    {item.required ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                        Required
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Optional</Badge>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteItemId(item.id)}
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit checklist item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              {editId ? 'Edit Checklist Item' : 'Add Checklist Item'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground -mt-1">
            For <strong className="text-foreground">{stage.label}</strong>
          </p>
          <div className="space-y-3 mt-1">
            <div className="space-y-1.5">
              <Label htmlFor="cl-label">Item label *</Label>
              <Input
                id="cl-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Call completed"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-desc">Description</Label>
              <Textarea
                id="cl-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="More detail about what needs to happen..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-sm font-medium">Required to advance?</Label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, required: !f.required }))}
                className={cn(
                  'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                  form.required ? 'bg-primary' : 'bg-muted-foreground/30'
                )}
              >
                <span
                  className={cn(
                    'inline-block h-3.5 w-3.5 rounded-full bg-background shadow transition-transform',
                    form.required ? 'translate-x-4' : 'translate-x-0.5'
                  )}
                />
              </button>
              <span className="text-xs text-muted-foreground">
                {form.required ? 'Required — blocks stage advance' : 'Optional — informational only'}
              </span>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={!form.label.trim()}
              className="shadow-sm shadow-primary/20"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {editId ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete checklist item confirm */}
      <Dialog open={!!deleteItemId} onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remove Checklist Item
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove{' '}
            <strong className="text-foreground">
              {sortedItems.find((i) => i.id === deleteItemId)?.label}
            </strong>{' '}
            from the <strong className="text-foreground">{stage.label}</strong> checklist?
            Existing lead progress for this item will no longer be tracked.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash className="mr-2 h-4 w-4" />
              Remove Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Settings Page ───────────────────────────────────────────────────────

export default function SettingsPage() {
  const stages = useQualificationStagesStore((s) => s.stages);
  const addStage = useQualificationStagesStore((s) => s.addStage);
  const updateStage = useQualificationStagesStore((s) => s.updateStage);
  const deleteStage = useQualificationStagesStore((s) => s.deleteStage);
  const reorderStages = useQualificationStagesStore((s) => s.reorderStages);
  const resetToDefaults = useQualificationStagesStore((s) => s.resetToDefaults);

  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.order - b.order),
    [stages]
  );

  // Add / Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_STAGE_FORM);

  // Delete confirm dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Reset confirm dialog
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Expanded checklist per stage
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  // Drag-and-drop refs
  const dragId = useRef<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const openAdd = () => {
    setEditingId(null);
    setForm(BLANK_STAGE_FORM);
    setDialogOpen(true);
  };

  const openEdit = (stage: QualificationStage) => {
    setEditingId(stage.id);
    setForm({ label: stage.label, description: stage.description, color: stage.color });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) {
      toast.error('Stage name is required.');
      return;
    }
    if (editingId) {
      updateStage(editingId, { label: form.label.trim(), description: form.description.trim(), color: form.color });
      toast.success('Stage updated.');
    } else {
      addStage({ label: form.label.trim(), description: form.description.trim(), color: form.color });
      toast.success('Stage added.');
    }
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
    resetToDefaults();
    setShowResetConfirm(false);
    setExpandedStageId(null);
    toast.success('Stages reset to defaults.');
  };

  // Drag handlers
  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragId.current = id;
    setDraggingId(id);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragEnd = useCallback(() => {
    dragId.current = null;
    setDraggingId(null);
    setDragOver(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(id);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragId.current;
    if (!sourceId || sourceId === targetId) {
      setDragOver(null);
      return;
    }
    const ordered = [...sortedStages];
    const fromIdx = ordered.findIndex((s) => s.id === sourceId);
    const toIdx = ordered.findIndex((s) => s.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    reorderStages(ordered.map((s) => s.id));
    dragId.current = null;
    setDraggingId(null);
    setDragOver(null);
  }, [sortedStages, reorderStages]);

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Page header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">Configuration</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mt-1">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage CRM configuration and workflow options.
        </p>
      </div>

      {/* Qualification Stages */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="pb-4 border-b border-border/60">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <CardTitle className="text-base font-semibold">Lead Qualification Stages</CardTitle>
              <CardDescription className="mt-1 text-sm leading-relaxed">
                Define the stages a lead moves through during qualification. Each stage can have a
                configurable checklist of required items that must be completed before the lead can
                advance. Drag rows to reorder.
              </CardDescription>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
                className="h-9 text-xs gap-1.5 text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset defaults
              </Button>
              <Button
                size="sm"
                onClick={openAdd}
                className="h-9 text-xs gap-1.5 shadow-md shadow-primary/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Stage
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4">
          {sortedStages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/8 border-2 border-dashed border-primary/30 mb-5">
                <CheckCircle className="h-8 w-8 text-primary/40" />
              </div>
              <h3 className="text-base font-semibold">No stages configured</h3>
              <p className="mt-2 max-w-xs text-sm text-muted-foreground leading-relaxed">
                Add qualification stages to track leads from discovery through to signing.
              </p>
              <Button className="mt-5 shadow-md shadow-primary/20" onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" />
                Add your first stage
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Header row */}
              <div className="grid grid-cols-[32px_1fr_auto_auto_auto] gap-3 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span />
                <span>Stage</span>
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
                  <div key={stage.id} className="rounded-xl border overflow-hidden transition-all duration-150">
                    {/* Stage row */}
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, stage.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, stage.id)}
                      onDrop={(e) => handleDrop(e, stage.id)}
                      className={cn(
                        'grid grid-cols-[32px_1fr_auto_auto_auto] gap-3 items-center px-3 py-3 transition-all duration-150',
                        isDragging
                          ? 'opacity-40 scale-[0.98] border-border/40 bg-card'
                          : isOver
                          ? 'border-primary/60 bg-primary/5'
                          : 'bg-card hover:bg-muted/20',
                      )}
                    >
                      {/* Drag handle */}
                      <div className="flex items-center justify-center cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {/* Stage info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold tabular-nums text-muted-foreground/50 w-5">{idx + 1}.</span>
                          <span className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold', pill)}>
                            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', dot)} />
                            {stage.label}
                          </span>
                        </div>
                        {stage.description && (
                          <p className="text-xs text-muted-foreground mt-1 pl-7 leading-relaxed">{stage.description}</p>
                        )}
                      </div>

                      {/* Color swatch */}
                      <div className="w-16 flex justify-center">
                        <span className={cn('h-2.5 w-2.5 rounded-full', dot)} />
                      </div>

                      {/* Checklist badge */}
                      <div className="w-20 flex justify-center">
                        <button
                          type="button"
                          onClick={() => setExpandedStageId(isExpanded ? null : stage.id)}
                          className={cn(
                            'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md font-medium transition-colors',
                            isExpanded
                              ? 'bg-primary/10 text-primary'
                              : itemCount > 0
                              ? 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                              : 'bg-dashed border border-dashed border-border/50 text-muted-foreground/50 hover:text-muted-foreground hover:border-border'
                          )}
                        >
                          <ClipboardList className="h-3 w-3" />
                          {itemCount > 0 ? (
                            <span>{itemCount}</span>
                          ) : (
                            <span className="text-[10px]">Add</span>
                          )}
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="w-16 flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(stage)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Edit stage"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(stage.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete stage"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded checklist editor */}
                    {isExpanded && (
                      <div className="px-4 pb-4 bg-muted/20 border-t border-border/40">
                        <ChecklistSection stage={stage} />
                        {requiredCount > 0 && (
                          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-2 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {requiredCount} required item{requiredCount !== 1 ? 's' : ''} — leads must complete {requiredCount === 1 ? 'this' : 'these'} before advancing.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              <p className="text-xs text-muted-foreground pt-2 pl-1">
                Drag rows to reorder. Click the checklist icon to configure required items per stage.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit stage dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Stage' : 'Add Stage'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="stage-label">Stage name *</Label>
              <Input
                id="stage-label"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Discovery Call"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage-desc">Description</Label>
              <Textarea
                id="stage-desc"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What happens at this stage?"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage-color">Colour</Label>
              <Select
                id="stage-color"
                value={form.color}
                onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                className="h-10 w-full"
              >
                {STAGE_COLORS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </Select>
              {/* Preview */}
              <div className="flex items-center gap-2 pt-1">
                <span className={cn('inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold', getStagePillClass(form.color))}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', getStageDotClass(form.color))} />
                  {form.label || 'Preview'}
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleSave}
              disabled={!form.label.trim()}
              className="shadow-sm shadow-primary/20"
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {editingId ? 'Save Changes' : 'Add Stage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete stage confirm dialog */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Stage
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{' '}
            <strong className="text-foreground">
              {stages.find((s) => s.id === deleteId)?.label}
            </strong>
            ? Leads currently assigned to this stage will retain their stage ID but it will no
            longer display in the pipeline. All checklist progress for this stage will be orphaned.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash className="mr-2 h-4 w-4" />
              Delete Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset confirm dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Reset to Defaults
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will replace all current stages with the four default stages (each with their
            default checklists):{' '}
            <strong className="text-foreground">Discovery Call, In-Person Meeting, Paperwork, Signed Client</strong>.
            Any custom stages and checklist items will be removed.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button onClick={handleReset} className="shadow-sm shadow-primary/20">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset Stages
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}