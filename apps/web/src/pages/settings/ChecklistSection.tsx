import { useState, useMemo, useRef, useCallback } from 'react';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Pencil, Trash, GripVertical, CheckCircle, AlertTriangle, ClipboardList, CheckSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { BLANK_CHECKLIST_FORM } from '@/pages/settings/stageColors';
import type { QualificationStage, StageChecklistItem } from '@/types';

export function ChecklistSection({ stage }: { stage: QualificationStage }) {
  const addChecklistItem = useQualificationStagesStore((s) => s.addChecklistItem);
  const updateChecklistItem = useQualificationStagesStore((s) => s.updateChecklistItem);
  const deleteChecklistItem = useQualificationStagesStore((s) => s.deleteChecklistItem);
  const reorderChecklistItems = useQualificationStagesStore((s) => s.reorderChecklistItems);

  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(BLANK_CHECKLIST_FORM);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const dragItemId = useRef<string | null>(null);
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => [...stage.checklistItems].sort((a, b) => a.order - b.order),
    [stage.checklistItems],
  );

  const openAdd = () => { setEditId(null); setForm(BLANK_CHECKLIST_FORM); setAddOpen(true); };
  const openEdit = (item: StageChecklistItem) => {
    setEditId(item.id);
    setForm({ label: item.label, description: item.description, required: item.required });
    setAddOpen(true);
  };

  const handleSave = () => {
    if (!form.label.trim()) { toast.error('Item label is required.'); return; }
    const payload = { label: form.label.trim(), description: form.description.trim(), required: form.required };
    if (editId) { updateChecklistItem(stage.id, editId, payload); toast.success('Checklist item updated.'); }
    else { addChecklistItem(stage.id, payload); toast.success('Checklist item added.'); }
    setAddOpen(false);
  };

  const handleDelete = useCallback(() => {
    if (!deleteItemId) return;
    deleteChecklistItem(stage.id, deleteItemId);
    setDeleteItemId(null);
    toast.success('Checklist item removed.');
  }, [deleteItemId, stage.id, deleteChecklistItem]);

  const handleItemDragStart = useCallback((e: React.DragEvent, itemId: string) => {
    dragItemId.current = itemId; setDraggingItemId(itemId); e.dataTransfer.effectAllowed = 'move';
  }, []);
  const handleItemDragEnd = useCallback(() => { dragItemId.current = null; setDraggingItemId(null); setDragOverItemId(null); }, []);
  const handleItemDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverItemId(itemId);
  }, []);
  const handleItemDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragItemId.current;
    if (!sourceId || sourceId === targetId) { setDragOverItemId(null); return; }
    const ordered = [...sortedItems];
    const fromIdx = ordered.findIndex((i) => i.id === sourceId);
    const toIdx = ordered.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, moved);
    reorderChecklistItems(stage.id, ordered.map((i) => i.id));
    dragItemId.current = null; setDraggingItemId(null); setDragOverItemId(null);
  }, [sortedItems, stage.id, reorderChecklistItems]);

  const requiredCount = sortedItems.filter((i) => i.required).length;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-3.5 w-3.5 text-muted-foreground/60" />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Checklist ({sortedItems.length} item{sortedItems.length !== 1 ? 's' : ''}{requiredCount > 0 ? `, ${requiredCount} required` : ''})
          </span>
        </div>
        <button type="button" onClick={openAdd} className="flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80">
          <Plus className="h-3 w-3" /> Add item
        </button>
      </div>

      {sortedItems.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border/50 bg-muted/20 px-3 py-2.5">
          <span className="text-xs text-muted-foreground/70">No checklist items — leads can advance freely between stages.</span>
          <button type="button" onClick={openAdd} className="ml-auto shrink-0 text-xs text-primary underline underline-offset-2 transition-colors hover:text-primary/80">Add one</button>
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
                className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2 transition-all duration-150',
                  isDragging ? 'scale-[0.98] border-border/40 bg-card opacity-40'
                    : isOver ? 'border-primary/60 bg-primary/5' : 'border-border/40 bg-card hover:border-border/70')}
              >
                <div className="mt-0.5 shrink-0 cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground/60 active:cursor-grabbing">
                  <GripVertical className="h-3.5 w-3.5" />
                </div>
                <CheckSquare className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', item.required ? 'text-warning' : 'text-muted-foreground/40')} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium">{item.label}</span>
                    {item.required ? (
                      <Badge variant="secondary" className="bg-warning/15 px-1.5 py-0 text-[10px] text-warning">Required</Badge>
                    ) : (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Optional</Badge>
                    )}
                  </div>
                  {item.description && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{item.description}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button type="button" onClick={() => openEdit(item)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => setDeleteItemId(item.id)} className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
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
          <p className="-mt-1 text-xs text-muted-foreground">For <strong className="text-foreground">{stage.label}</strong></p>
          <div className="mt-1 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-label">Item label *</Label>
              <Input id="cl-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Call completed" autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-desc">Description</Label>
              <Textarea id="cl-desc" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="More detail about what needs to happen..." rows={2} />
            </div>
            <div className="flex items-center gap-3 pt-1">
              <Label className="text-sm font-medium">Required to advance?</Label>
              <button type="button" onClick={() => setForm((f) => ({ ...f, required: !f.required }))}
                className={cn('relative inline-flex h-5 w-9 items-center rounded-full transition-colors', form.required ? 'bg-primary' : 'bg-muted-foreground/30')}>
                <span className={cn('inline-block h-3.5 w-3.5 rounded-full bg-background shadow transition-transform', form.required ? 'translate-x-4' : 'translate-x-0.5')} />
              </button>
              <span className="text-xs text-muted-foreground">{form.required ? 'Required — blocks stage advance' : 'Optional — informational only'}</span>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button onClick={handleSave} disabled={!form.label.trim()}>
              <CheckCircle className="mr-2 h-4 w-4" />{editId ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete checklist item confirm */}
      <Dialog open={!!deleteItemId} onOpenChange={(open) => { if (!open) setDeleteItemId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Remove Checklist Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong className="text-foreground">{sortedItems.find((i) => i.id === deleteItemId)?.label}</strong> from the{' '}
            <strong className="text-foreground">{stage.label}</strong> checklist? Existing lead progress for this item will no longer be tracked.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete}><Trash className="mr-2 h-4 w-4" />Remove Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
