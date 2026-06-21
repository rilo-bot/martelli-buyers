import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash, GripVertical, CheckCircle, AlertTriangle,
  ClipboardList, Loader2, RotateCcw, Eye, EyeOff, FolderPlus,
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
const MAX_SECTION = 120;
/** Heading shown for items that have no section assigned. */
const UNGROUPED_LABEL = 'General';

const cloneDefaults = (): DDChecklistTemplateItem[] => DD_CHECKLIST_TEMPLATE_DEFAULTS.map((i) => ({ ...i }));

/** The stored template, or the full default set when nothing is configured yet. */
function toDraft(template: DDChecklistTemplateItem[] | undefined): DDChecklistTemplateItem[] {
  return template && template.length > 0
    ? template.map((i) => ({ ...i, section: i.section ?? '' }))
    : cloneDefaults();
}

/** Order items into section groups by first appearance, preserving item order. */
function groupBySection(items: DDChecklistTemplateItem[]): { section: string; items: DDChecklistTemplateItem[] }[] {
  const groups: { section: string; items: DDChecklistTemplateItem[] }[] = [];
  const byName = new Map<string, (typeof groups)[number]>();
  for (const item of items) {
    const key = item.section ?? '';
    let group = byName.get(key);
    if (!group) {
      group = { section: key, items: [] };
      byName.set(key, group);
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

/**
 * Settings → Due Diligence. Lets admins configure the audit checklist as
 * sections, each holding its own points (toggle, add, rename, remove, reorder).
 * The template is stored org-wide on company settings; each new DD record
 * snapshots the enabled items — grouped under the same section headings — so
 * changes here never touch records already created.
 */
export function DueDiligenceSettings() {
  const settings = useCompanySettingsStore((s) => s.settings);
  const loaded = useCompanySettingsStore((s) => s.loaded);
  const fetch = useCompanySettingsStore((s) => s.fetch);
  const save = useCompanySettingsStore((s) => s.save);

  const [items, setItems] = useState<DDChecklistTemplateItem[]>(() => toDraft(settings?.ddChecklistTemplate));
  const [saving, setSaving] = useState(false);

  // Item add / rename editor.
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState('');
  const [sectionDraft, setSectionDraft] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Section rename / delete.
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [sectionNameDraft, setSectionNameDraft] = useState('');
  const [deleteSection, setDeleteSection] = useState<string | null>(null);

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
  const groups = useMemo(() => groupBySection(items), [items]);
  const existingSections = useMemo(
    () => Array.from(new Set(items.map((i) => (i.section ?? '').trim()).filter(Boolean))),
    [items],
  );

  const toggle = (id: string) =>
    setItems((list) => list.map((i) => (i.id === id ? { ...i, enabled: !i.enabled } : i)));

  const openAdd = (section = '') => { setEditId(null); setLabelDraft(''); setSectionDraft(section); setEditorOpen(true); };
  const openEdit = (item: DDChecklistTemplateItem) => {
    setEditId(item.id); setLabelDraft(item.label); setSectionDraft(item.section ?? ''); setEditorOpen(true);
  };

  const handleEditorSave = () => {
    const label = labelDraft.trim().slice(0, MAX_LABEL);
    if (!label) { toast.error('Item label is required.'); return; }
    const section = sectionDraft.trim().slice(0, MAX_SECTION);
    if (editId) {
      setItems((list) => list.map((i) => (i.id === editId ? { ...i, label, section } : i)));
    } else {
      const next: DDChecklistTemplateItem = { id: crypto.randomUUID(), label, section, enabled: true };
      setItems((list) => {
        // Drop a new point at the end of its section so it lands under the right
        // heading; a brand-new section goes to the bottom of the list.
        const lastIdx = section ? list.map((i) => i.section ?? '').lastIndexOf(section) : -1;
        if (lastIdx === -1) return [...list, next];
        const copy = [...list];
        copy.splice(lastIdx + 1, 0, next);
        return copy;
      });
    }
    setEditorOpen(false);
  };

  const handleDelete = useCallback(() => {
    if (!deleteId) return;
    setItems((list) => list.filter((i) => i.id !== deleteId));
    setDeleteId(null);
  }, [deleteId]);

  const openRenameSection = (section: string) => { setRenameTarget(section); setSectionNameDraft(section); };
  const handleRenameSection = () => {
    if (renameTarget === null) return;
    const next = sectionNameDraft.trim().slice(0, MAX_SECTION);
    setItems((list) => list.map((i) => ((i.section ?? '') === renameTarget ? { ...i, section: next } : i)));
    setRenameTarget(null);
  };

  const handleDeleteSection = useCallback(() => {
    if (deleteSection === null) return;
    setItems((list) => list.filter((i) => (i.section ?? '') !== deleteSection));
    setDeleteSection(null);
  }, [deleteSection]);

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
      const target = next.find((i) => i.id === targetId);
      // Dropping onto an item in another section moves the point into it.
      moved.section = target ? target.section ?? '' : moved.section;
      const insertAt = next.findIndex((i) => i.id === targetId);
      next.splice(insertAt, 0, moved);
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
                Organise checklist points into sections. Each new Due Diligence record shows the
                enabled points grouped under the same headings. Disabled points are hidden; existing
                records keep the items they were created with.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => openAdd('')}>
                <FolderPlus className="mr-1.5 h-3.5 w-3.5" /> Add section
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {groups.length} section{groups.length !== 1 ? 's' : ''} · {items.length} point{items.length !== 1 ? 's' : ''} · {enabledCount} shown
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
              At least one point must stay enabled — new DD records need a checklist to complete.
            </div>
          )}

          <div className="space-y-6">
            {groups.map((group) => {
              const sectionKey = group.section;
              const heading = sectionKey || UNGROUPED_LABEL;
              const shown = group.items.filter((i) => i.enabled).length;
              return (
                <div key={heading} className="space-y-1.5">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
                    <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{heading}</h3>
                    <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                      {group.items.length} point{group.items.length !== 1 ? 's' : ''} · {shown} shown
                    </span>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => openAdd(sectionKey)}
                        title="Add point to this section"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => openRenameSection(sectionKey)}
                        title="Rename section"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteSection(sectionKey)}
                        title="Delete section and its points"
                        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-0.5">
                    {group.items.map((item) => {
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
                              title="Edit point"
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteId(item.id)}
                              title="Remove point"
                              className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Add / edit point */}
      <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
        <SheetContent size="sm">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              {editId ? 'Edit Checklist Point' : 'Add Checklist Point'}
            </SheetTitle>
          </SheetHeader>
          <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="dd-item-section">Section</Label>
              <Input
                id="dd-item-section"
                list="dd-section-options"
                value={sectionDraft}
                maxLength={MAX_SECTION}
                onChange={(e) => setSectionDraft(e.target.value)}
                placeholder="e.g. Legalities"
              />
              <datalist id="dd-section-options">
                {existingSections.map((s) => <option key={s} value={s} />)}
              </datalist>
              <p className="text-[11px] text-muted-foreground">
                Type a new name to create a section, or pick an existing one. Leave blank for “{UNGROUPED_LABEL}”.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dd-item-label">Point *</Label>
              <Input
                id="dd-item-label"
                value={labelDraft}
                maxLength={MAX_LABEL}
                onChange={(e) => setLabelDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEditorSave(); } }}
                placeholder="e.g. LIM report reviewed"
                autoFocus
              />
            </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild><Button variant="ghost">Cancel</Button></SheetClose>
            <Button onClick={handleEditorSave} disabled={!labelDraft.trim()}>
              <CheckCircle className="mr-2 h-4 w-4" />{editId ? 'Save' : 'Add Point'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Rename section */}
      <Dialog open={renameTarget !== null} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />Rename Section
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="dd-section-name">Section name</Label>
            <Input
              id="dd-section-name"
              value={sectionNameDraft}
              maxLength={MAX_SECTION}
              onChange={(e) => setSectionNameDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRenameSection(); } }}
              placeholder={UNGROUPED_LABEL}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">Renames every point in this section. Leave blank for “{UNGROUPED_LABEL}”.</p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button onClick={handleRenameSection}><CheckCircle className="mr-2 h-4 w-4" />Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete point confirm */}
      <Dialog open={!!deleteId} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />Remove Checklist Point
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

      {/* Delete section confirm */}
      <Dialog open={deleteSection !== null} onOpenChange={(open) => { if (!open) setDeleteSection(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />Delete Section
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Delete <strong className="text-foreground">{deleteSection || UNGROUPED_LABEL}</strong> and all
            {' '}{items.filter((i) => (i.section ?? '') === deleteSection).length} of its point(s) from the template?
            New DD records won’t include them. Existing records are unchanged.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={handleDeleteSection}><Trash className="mr-2 h-4 w-4" />Delete section</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
