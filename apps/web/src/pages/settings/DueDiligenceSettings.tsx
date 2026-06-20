import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash, GripVertical, CheckCircle, AlertTriangle,
  ClipboardList, Loader2, RotateCcw, Eye, EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useCompanySettingsStore } from '@/stores/companySettingsStore';
import { ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { DD_CHECKLIST_TEMPLATE_DEFAULTS, type DDChecklistTemplateItem } from '@/types';

const MAX_LABEL = 200;

const cloneDefaults = (): DDChecklistTemplateItem[] => DD_CHECKLIST_TEMPLATE_DEFAULTS.map((i) => ({ ...i }));

/** The stored template, or the full default set when nothing is configured yet. */
function toDraft(template: DDChecklistTemplateItem[] | undefined): DDChecklistTemplateItem[] {
  return template && template.length > 0 ? template.map((i) => ({ ...i })) : cloneDefaults();
}

/**
 * Settings → Due Diligence. Lets admins choose which audit-checklist items appear
 * on new DD records (toggle, add, rename, remove, reorder). The template is stored
 * org-wide on company settings; each new DD record snapshots the enabled items, so
 * changes here never touch records already created.
 */
export function DueDiligenceSettings() {
  const settings = useCompanySettingsStore((s) => s.settings);
  const loaded = useCompanySettingsStore((s) => s.loaded);
  const fetch = useCompanySettingsStore((s) => s.fetch);
  const save = useCompanySettingsStore((s) => s.save);

  const [items, setItems] = useState<DDChecklistTemplateItem[]>(() => toDraft(settings?.ddChecklistTemplate));
  const [saving, setSaving] = useState(false);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const dragId = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Load settings if an admin deep-links here before bootstrap finishes.
  useEffect(() => { if (!loaded) fetch().catch(() => {}); }, [loaded, fetch]);
  // Re-sync the draft whenever the stored template loads or changes elsewhere.
  useEffect(() => { setItems(toDraft(settings?.ddChecklistTemplate)); }, [settings]);

  const stored = useMemo(() => toDraft(settings?.ddChecklistTemplate), [settings]);
  const dirty = JSON.stringify(items) !== JSON.stringify(stored);
  const enabledCount = items.filter((i) => i.enabled).length;

  const toggle = (id: string) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)));

  const openAdd = () => { setEditId(null); setLabelDraft(''); setEditorOpen(true); };
  const openEdit = (item: DDChecklistTemplateItem) => { setEditId(item.id); setLabelDraft(item.label); setEditorOpen(true); };

  const handleEditorSave = () => {
    const label = labelDraft.trim().slice(0, MAX_LABEL);
    if (!label) { toast.error('Item label is required.'); return; }
    if (editId) {
      setItems((list) => list.map((i) => (i.id === editId ? { ...i, label } : i)));
    } else {
      setItems((list) => [...list, { id: crypto.randomUUID(), label, enabled: true }]);
    }
    setEditorOpen(false);
  };

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    setItems((list) => list.filter((i) => i.id !== deleteId));
    setDeleteId(null);
  }, [deleteId]);

  const handleDragStart = useCallback((e: React.DragEvent, id: string) => {
    dragId.current = id; setDraggingId(id); e.dataTransfer.effectAllowed = 'move';
  }, []);
  const handleDragEnd = useCallback(() => { dragId.current = null; setDraggingId(null); setDragOverId(null); }, []);
  const handleDragOver = useCallback((e: React.DragEvent, id: string) => {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverId(id);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = dragId.current;
    dragId.current = null; setDraggingId(null); setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;
    setItems((list) => {
      const next = [...list];
      const from = next.findIndex((i) => i.id === sourceId);
      const to = next.findIndex((i) => i.id === targetId);
      if (from === -1 || to === -1) return list;
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const handleReset = () => setItems(cloneDefaults());

  const handleSave = async () => {
    if (enabledCount === 0) { toast.error('Keep at least one checklist item enabled.'); return; }
    setSaving(true);
    try {
      await save({ ddChecklistTemplate: items });
      toast.success('Audit checklist saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the checklist.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading Due Diligence settings…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" /> Internal Audit Checklist
              </CardTitle>
              <CardDescription className="mt-1 text-sm">
                Choose which items appear on new Due Diligence records. Disabled items are hidden;
                existing records keep the items they were created with.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {items.length} item{items.length !== 1 ? 's' : ''} · {enabledCount} shown
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" /> Reset to defaults
            </button>
          </div>

          {enabledCount === 0 && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              At least one item must stay enabled — new DD records need a checklist to complete.
            </div>
          )}

          <div className="space-y-1.5">
            {items.map((item) => {
              const isOver = dragOverId === item.id;
              const isDragging = draggingId === item.id;
              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDrop={(e) => handleDrop(e, item.id)}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-150',
                    isDragging ? 'scale-[0.98] border-border/40 bg-card opacity-40'
                      : isOver ? 'border-primary/60 bg-primary/5'
                      : 'border-border/40 bg-card hover:border-border/70',
                    !item.enabled && 'opacity-60',
                  )}
                >
                  <div className="shrink-0 cursor-grab text-muted-foreground/30 transition-colors hover:text-muted-foreground/60 active:cursor-grabbing">
                    <GripVertical className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={cn('text-sm font-medium', !item.enabled && 'line-through text-muted-foreground')}>
                        {item.label}
                      </span>
                      {!item.enabled && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Hidden</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      title={item.enabled ? 'Hide from new records' : 'Show on new records'}
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded transition-colors',
                        item.enabled ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {item.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => openEdit(item)}
                      title="Rename"
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(item.id)}
                      title="Remove"
                      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => setItems(stored)} disabled={!dirty || saving}>
          Discard changes
        </Button>
        <Button type="button" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : 'Save changes'}
        </Button>
      </div>

      {/* Add / rename item */}
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent size="sm">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              {editId ? 'Rename Checklist Item' : 'Add Checklist Item'}
            </SheetTitle>
          </SheetHeader>
          <SheetBody>
            <div className="space-y-1.5">
              <Label htmlFor="dd-item-label">Item label *</Label>
              <Input
                id="dd-item-label"
                value={labelDraft}
                maxLength={MAX_LABEL}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEditorSave(); } }}
                placeholder="e.g. PIM report reviewed"
                autoFocus
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild><Button variant="ghost">Cancel</Button></SheetClose>
            <Button onClick={handleEditorSave} disabled={!labelDraft.trim()}>
              <CheckCircle className="mr-2 h-4 w-4" />{editId ? 'Save' : 'Add Item'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />Remove Checklist Item
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong className="text-foreground">{items.find((i) => i.id === deleteId)?.label}</strong> from the
            audit checklist template? New DD records won’t include it. Existing records are unchanged.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDelete}><Trash className="mr-2 h-4 w-4" />Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
