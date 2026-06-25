import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { UploadCloud, X, Loader2, FileText } from 'lucide-react';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useDocumentsStore } from '@/stores/documentsStore';
import { useAuthStore } from '@/stores/authStore';
import type { Document, DocumentCategory, DocumentEntityType } from '@/types';
import {
  CATEGORY_OPTIONS, ATTACHABLE_TYPES, ENTITY_TYPE_LABELS, useEntityCatalog, formatBytes,
} from './entityMeta';

type Category = DocumentCategory | '';

/** Where a document is (optionally) attached. */
export interface AttachLink {
  entityType: DocumentEntityType | '';
  entityId: string;
}

/* ─────────────────────────── tag input ──────────────────────────── */

function TagInput({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const t = raw.trim();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
      {tags.map((t) => (
        <Badge key={t} variant="secondary" className="gap-1">
          {t}
          <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${t}`}>
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); }
          else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => add(draft)}
        placeholder={tags.length ? '' : 'Add tags…'}
        className="min-w-[6rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

/* ───────────────────────── entity picker ────────────────────────── */

function EntityPicker({ value, onChange }: { value: AttachLink; onChange: (next: AttachLink) => void }) {
  const catalog = useEntityCatalog();
  const [filter, setFilter] = useState('');
  const items = value.entityType ? catalog[value.entityType].items : [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? items.filter((it) => it.label.toLowerCase().includes(q)) : items;
  }, [items, filter]);

  return (
    <div className="space-y-2">
      <Select
        value={value.entityType}
        onChange={(e) => { onChange({ entityType: e.target.value as DocumentEntityType | '', entityId: '' }); setFilter(''); }}
      >
        <option value="">Not attached</option>
        {ATTACHABLE_TYPES.map((t) => (
          <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>
        ))}
      </Select>
      {value.entityType && (
        items.length > 8 ? (
          <>
            <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={`Search ${ENTITY_TYPE_LABELS[value.entityType].toLowerCase()}…`} />
            <Select value={value.entityId} onChange={(e) => onChange({ ...value, entityId: e.target.value })}>
              <option value="">Select a record…</option>
              {filtered.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
            </Select>
          </>
        ) : (
          <Select value={value.entityId} onChange={(e) => onChange({ ...value, entityId: e.target.value })}>
            <option value="">Select a record…</option>
            {items.map((it) => <option key={it.id} value={it.id}>{it.label}</option>)}
          </Select>
        )
      )}
    </div>
  );
}

/* ───────────────────────── shared meta fields ───────────────────── */

function MetaFields({
  category, onCategory, tags, onTags, description, onDescription,
}: {
  category: Category; onCategory: (c: Category) => void;
  tags: string[]; onTags: (t: string[]) => void;
  description: string; onDescription: (d: string) => void;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={category} onChange={(e) => onCategory(e.target.value as Category)}>
          <option value="">Uncategorised</option>
          {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Tags</Label>
        <TagInput tags={tags} onChange={onTags} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="doc-desc">Description</Label>
        <Textarea id="doc-desc" value={description} onChange={(e) => onDescription(e.target.value)} placeholder="Optional notes about this document" rows={2} />
      </div>
    </>
  );
}

const ACCEPT = 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

/* ───────────────────────── upload dialog ────────────────────────── */

/**
 * Upload one or more files as catalogued documents. When `lockedTarget` is given
 * (launched from an entity's panel) the attachment is fixed and hidden; otherwise
 * the user may attach the upload to any module via the picker.
 */
export function DocumentUploadDialog({
  open, onClose, lockedTarget, defaultCategory = '',
}: {
  open: boolean;
  onClose: () => void;
  lockedTarget?: AttachLink & { dealId?: string };
  defaultCategory?: Category;
}) {
  const uploadAndAttach = useDocumentsStore((s) => s.uploadAndAttach);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState<Category>(defaultCategory);
  const [tags, setTags] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [link, setLink] = useState<AttachLink>({ entityType: '', entityId: '' });
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFiles([]); setCategory(defaultCategory); setTags([]); setDescription('');
      setLink({ entityType: '', entityId: '' });
    }
  }, [open, defaultCategory]);

  const addFiles = (list: FileList | null) => {
    if (list) setFiles((prev) => [...prev, ...Array.from(list)]);
    if (fileRef.current) fileRef.current.value = '';
  };

  const target = lockedTarget ?? link;
  // An attachment must be complete (both parts) or fully empty (standalone).
  const linkIncomplete = !lockedTarget && link.entityType !== '' && !link.entityId;
  const canUpload = files.length > 0 && !linkIncomplete && !busy;

  const submit = async () => {
    if (!canUpload) return;
    setBusy(true);
    let failed = 0;
    for (const file of files) {
      try {
        await uploadAndAttach(file, {
          entityType: target.entityType,
          entityId: target.entityId,
          dealId: lockedTarget?.dealId ?? (target.entityType === 'deal' ? target.entityId : ''),
          category,
          tags,
          description,
          uploadedBy: currentUser?.id ?? '',
        });
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    if (failed) toast.error(`${failed} file${failed === 1 ? '' : 's'} failed to upload.`);
    if (failed < files.length) toast.success(`${files.length - failed} document${files.length - failed === 1 ? '' : 's'} uploaded.`);
    if (!failed) onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <SheetContent size="lg">
        <SheetHeader><SheetTitle>Upload documents</SheetTitle></SheetHeader>

        <SheetBody className="space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 py-8 text-center transition-colors hover:border-primary/40 hover:bg-primary/5"
          >
            <UploadCloud className="h-8 w-8 text-primary/50" />
            <span className="text-sm font-medium">Click to choose files</span>
            <span className="text-xs text-muted-foreground">Images, PDF, Word, Excel, PowerPoint, text</span>
          </button>
          <input ref={fileRef} type="file" multiple hidden accept={ACCEPT} onChange={(e) => addFiles(e.target.files)} />

          {files.length > 0 && (
            <ul className="space-y-1 rounded-md border border-border/60 p-1">
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{f.name}</span>
                  <span className="text-xs text-muted-foreground">{formatBytes(f.size)}</span>
                  <button type="button" onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive" aria-label="Remove file">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <MetaFields
            category={category} onCategory={setCategory}
            tags={tags} onTags={setTags}
            description={description} onDescription={setDescription}
          />

          {!lockedTarget && (
            <div className="space-y-1.5">
              <Label>Attach to (optional)</Label>
              <EntityPicker value={link} onChange={setLink} />
            </div>
          )}
        </SheetBody>

        <SheetFooter>
          <SheetClose asChild><Button variant="ghost" disabled={busy}>Cancel</Button></SheetClose>
          <Button onClick={submit} disabled={!canUpload}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</> : `Upload${files.length ? ` ${files.length}` : ''}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────────── edit dialog ──────────────────────────── */

/** Edit a document's name, category, tags, description and attachment target. */
export function DocumentEditDialog({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: Document }) {
  const updateDocument = useDocumentsStore((s) => s.updateDocument);
  const [name, setName] = useState(doc.name);
  const [category, setCategory] = useState<Category>(doc.category);
  const [tags, setTags] = useState<string[]>(doc.tags);
  const [description, setDescription] = useState(doc.description);
  const [link, setLink] = useState<AttachLink>({ entityType: doc.entityType, entityId: doc.entityId });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(doc.name); setCategory(doc.category); setTags(doc.tags);
      setDescription(doc.description); setLink({ entityType: doc.entityType, entityId: doc.entityId });
    }
  }, [open, doc]);

  const linkIncomplete = link.entityType !== '' && !link.entityId;
  const canSave = !!name.trim() && !linkIncomplete && !busy;

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await updateDocument(doc.id, {
        name: name.trim(),
        category,
        tags,
        description: description.trim(),
        entityType: link.entityType,
        entityId: link.entityId,
        dealId: link.entityType === 'deal' ? link.entityId : '',
      });
      toast.success('Document updated.');
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update document.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o && !busy) onClose(); }}>
      <SheetContent size="lg">
        <SheetHeader><SheetTitle>Edit document</SheetTitle></SheetHeader>

        <SheetBody className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="doc-name">Name</Label>
            <Input id="doc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <MetaFields
            category={category} onCategory={setCategory}
            tags={tags} onTags={setTags}
            description={description} onDescription={setDescription}
          />
          <div className="space-y-1.5">
            <Label>Attached to</Label>
            <EntityPicker value={link} onChange={setLink} />
          </div>
        </SheetBody>

        <SheetFooter>
          <SheetClose asChild><Button variant="ghost" disabled={busy}>Cancel</Button></SheetClose>
          <Button onClick={save} disabled={!canSave}>
            {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
