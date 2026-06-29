import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Loader2, Eye, EyeOff, Pencil, Trash, Plus, ArrowUp, ArrowDown, Lock,
  Globe, Copy, Check, RotateCcw, AlertTriangle, ClipboardList, Palette, Type, Rocket,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useCompanySettingsStore } from '@/stores/companySettingsStore';
import { getApiOrigin, ApiError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ContactFormRenderer } from '@/components/contact-form/ContactFormRenderer';
import {
  CONTACT_FORM_FIELD_CATALOG,
  CONTACT_FORM_STYLE_DEFAULTS,
  CONTACT_FORM_CONTENT_DEFAULTS,
  CONTACT_FORM_LOCKED_KEYS,
  type ContactFormField,
  type ContactFormFieldType,
  type ContactFormStyles,
  type ContactFormContent,
  type ContactFormConfig,
  type PublicContactForm,
} from '@/types';

const LOCKED = new Set<string>(CONTACT_FORM_LOCKED_KEYS);
const FIELD_TYPES: { value: ContactFormFieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'textarea', label: 'Paragraph' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' },
];

interface Draft {
  fields: ContactFormField[];
  styles: ContactFormStyles;
  content: ContactFormContent;
  allowedOrigins: string[];
}

const cloneFields = (fields: ContactFormField[]): ContactFormField[] =>
  fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined }));

function toDraft(cf: ContactFormConfig | undefined | null): Draft {
  const fields = cf?.fields?.length ? cf.fields : CONTACT_FORM_FIELD_CATALOG;
  return {
    fields: cloneFields(fields),
    styles: { ...CONTACT_FORM_STYLE_DEFAULTS, ...(cf?.styles ?? {}) },
    content: {
      ...CONTACT_FORM_CONTENT_DEFAULTS,
      ...(cf?.content ?? {}),
      contactDetails: (cf?.content?.contactDetails ?? CONTACT_FORM_CONTENT_DEFAULTS.contactDetails).map((d) => ({ ...d })),
    },
    allowedOrigins: cf?.allowedOrigins ? [...cf.allowedOrigins] : [],
  };
}

/** Build a unique, server-valid field key from a label. */
function makeKey(label: string, taken: Set<string>): string {
  let base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36);
  if (!base || !/^[a-z]/.test(base)) base = `field_${base}`.slice(0, 36);
  let key = base;
  let n = 2;
  while (taken.has(key)) key = `${base}_${n++}`;
  return key;
}

type Tab = 'fields' | 'design' | 'content' | 'embed';
const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'fields', label: 'Fields', icon: ClipboardList },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'content', label: 'Content', icon: Type },
  { id: 'embed', label: 'Publish & embed', icon: Rocket },
];

/**
 * Settings → Contact Form. Admins customise the public contact form (fields,
 * design, content), publish it for a secure token + embed snippet, and the same
 * config drives both the hosted /contact-us page and the embeddable widget.
 */
export function ContactFormSettings() {
  const settings = useCompanySettingsStore((s) => s.settings);
  const loaded = useCompanySettingsStore((s) => s.loaded);
  const fetch = useCompanySettingsStore((s) => s.fetch);
  const saveContactForm = useCompanySettingsStore((s) => s.saveContactForm);
  const publish = useCompanySettingsStore((s) => s.publishContactForm);
  const unpublish = useCompanySettingsStore((s) => s.unpublishContactForm);
  const regenerate = useCompanySettingsStore((s) => s.regenerateContactFormToken);

  const cf = settings?.contactForm;
  const [tab, setTab] = useState<Tab>('fields');
  const [draft, setDraft] = useState<Draft>(() => toDraft(cf));
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Field editor + confirm dialogs.
  const [editorKey, setEditorKey] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [confirmRegen, setConfirmRegen] = useState(false);

  useEffect(() => { if (!loaded) fetch().catch(() => {}); }, [loaded, fetch]);
  useEffect(() => { setDraft(toDraft(cf)); /* re-sync when stored config changes */ }, [cf]);

  const stored = useMemo(() => toDraft(cf), [cf]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(stored);
  const enabledCount = draft.fields.filter((f) => f.enabled).length;

  const published = !!cf?.published;
  const token = cf?.token ?? '';
  const apiOrigin = getApiOrigin() || (typeof window !== 'undefined' ? window.location.origin : '');
  const snippet = `<script src="${apiOrigin}/api/public/embed.js" data-form-token="${token}" async></script>`;

  const previewConfig: PublicContactForm = {
    fields: draft.fields.filter((f) => f.enabled),
    styles: draft.styles,
    content: draft.content,
    logoDataUrl: draft.styles.showLogo ? settings?.logoDataUrl || '' : '',
    firmName: settings?.firmName || '',
  };

  /* ── field ops ──────────────────────────────────────────────────────── */
  const patchField = (key: string, patch: Partial<ContactFormField>) =>
    setDraft((d) => ({ ...d, fields: d.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)) }));

  const toggleEnabled = (f: ContactFormField) => { if (!LOCKED.has(f.key)) patchField(f.key, { enabled: !f.enabled }); };
  const toggleRequired = (f: ContactFormField) => { if (!LOCKED.has(f.key)) patchField(f.key, { required: !f.required }); };

  const moveField = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const next = [...d.fields];
      const to = index + dir;
      if (to < 0 || to >= next.length) return d;
      [next[index], next[to]] = [next[to], next[index]];
      return { ...d, fields: next };
    });

  const removeField = () => {
    if (!deleteKey) return;
    setDraft((d) => ({ ...d, fields: d.fields.filter((f) => f.key !== deleteKey) }));
    setDeleteKey(null);
  };

  const addField = () => { setIsNew(true); setEditorKey('__new__'); };
  const editField = (key: string) => { setIsNew(false); setEditorKey(key); };

  /* ── style/content ops ─────────────────────────────────────────────── */
  const patchStyle = (patch: Partial<ContactFormStyles>) => setDraft((d) => ({ ...d, styles: { ...d.styles, ...patch } }));
  const patchContent = (patch: Partial<ContactFormContent>) => setDraft((d) => ({ ...d, content: { ...d.content, ...patch } }));

  /* ── persistence ────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (enabledCount === 0) { toast.error('Keep at least one field enabled.'); return; }
    setSaving(true);
    try {
      await saveContactForm({
        fields: draft.fields,
        styles: draft.styles,
        content: draft.content,
        allowedOrigins: draft.allowedOrigins,
      });
      toast.success('Contact form saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save the contact form.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Could not copy. Select the text and copy manually.');
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading contact form settings…
      </div>
    );
  }

  const editing = editorKey ? (isNew ? null : draft.fields.find((f) => f.key === editorKey) ?? null) : null;

  return (
    <div className="space-y-5">
      {/* Toolbar: reset (left) + editor ⇄ preview toggle (right) */}
      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setDraft(toDraft(null))}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to default design
        </Button>
        <Button
          type="button"
          variant={previewOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setPreviewOpen((p) => !p)}
        >
          <Eye className="mr-1.5 h-3.5 w-3.5" /> {previewOpen ? 'Back to editor' : 'Preview'}
        </Button>
      </div>

      {previewOpen ? (
        /* ── Inline live preview (centered) ── */
        <Card className="border-border/80 shadow-sm">
          <CardContent className="bg-muted/30 py-8">
            <div className="mx-auto max-w-2xl">
              <ContactFormRenderer config={previewConfig} preview />
            </div>
          </CardContent>
        </Card>
      ) : (
        /* ── Editor ── */
        <Card className="border-border/80 shadow-sm">
          <CardHeader className="border-b border-border/60 pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ClipboardList className="h-4 w-4 text-primary" /> Contact Form
            </CardTitle>
            <CardDescription className="mt-1 text-sm">
              Customise the public form, then publish it to embed anywhere. Submissions land in your
              Enquiries inbox. The same form powers your hosted <code className="text-xs">/contact-us</code> page.
            </CardDescription>
            {/* Sub-tabs */}
            <div className="mt-3 flex flex-wrap gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors',
                    tab === t.id ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                >
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
            </div>
          </CardHeader>

          <CardContent className="pt-5">
            {tab === 'fields' && (
              <FieldsTab
                fields={draft.fields}
                enabledCount={enabledCount}
                onToggleEnabled={toggleEnabled}
                onToggleRequired={toggleRequired}
                onMove={moveField}
                onEdit={editField}
                onDelete={(k) => setDeleteKey(k)}
                onAdd={addField}
              />
            )}
            {tab === 'design' && <DesignTab styles={draft.styles} onChange={patchStyle} />}
            {tab === 'content' && <ContentTab content={draft.content} onChange={patchContent} />}
            {tab === 'embed' && (
              <EmbedTab
                published={published}
                token={token}
                snippet={snippet}
                copied={copied}
                busy={busy}
                dirty={dirty}
                allowedOrigins={draft.allowedOrigins}
                onOriginsChange={(arr) => setDraft((d) => ({ ...d, allowedOrigins: arr }))}
                onPublish={() => runAction(publish, 'Form published.')}
                onUnpublish={() => runAction(unpublish, 'Form unpublished.')}
                onRegenerate={() => setConfirmRegen(true)}
                onCopy={copySnippet}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* Save bar */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty && <span className="mr-auto text-xs text-muted-foreground">You have unsaved changes.</span>}
        <Button type="button" variant="ghost" onClick={() => setDraft(stored)} disabled={!dirty || saving}>
          Discard
        </Button>
        <Button type="button" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : 'Save changes'}
        </Button>
      </div>

      {/* Field editor */}
      <FieldEditorSheet
        open={editorKey !== null}
        isNew={isNew}
        field={editing}
        existingKeys={draft.fields.map((f) => f.key)}
        onClose={() => setEditorKey(null)}
        onSubmit={(field) => {
          setDraft((d) => {
            if (isNew) return { ...d, fields: [...d.fields, field] };
            return { ...d, fields: d.fields.map((f) => (f.key === field.key ? field : f)) };
          });
          setEditorKey(null);
        }}
      />

      {/* Delete field confirm */}
      <Dialog open={!!deleteKey} onOpenChange={(open) => { if (!open) setDeleteKey(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Remove field
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong className="text-foreground">{draft.fields.find((f) => f.key === deleteKey)?.label}</strong> from
            the form? This can't be undone (you can re-add a custom field later).
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={removeField}><Trash className="mr-2 h-4 w-4" /> Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate token confirm */}
      <Dialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Regenerate token
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This issues a new token and <strong className="text-foreground">immediately breaks every existing embed</strong>.
            You'll need to paste the new snippet everywhere the form is used.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() => { setConfirmRegen(false); runAction(regenerate, 'New token issued.'); }}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ──────────────────────────── Fields tab ──────────────────────────────── */
function FieldsTab({
  fields, enabledCount, onToggleEnabled, onToggleRequired, onMove, onEdit, onDelete, onAdd,
}: {
  fields: ContactFormField[];
  enabledCount: number;
  onToggleEnabled: (f: ContactFormField) => void;
  onToggleRequired: (f: ContactFormField) => void;
  onMove: (index: number, dir: -1 | 1) => void;
  onEdit: (key: string) => void;
  onDelete: (key: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {fields.length} field{fields.length !== 1 ? 's' : ''} · {enabledCount} shown
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onAdd}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add custom field
        </Button>
      </div>

      {enabledCount === 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Enable at least one field.
        </div>
      )}

      <div className="space-y-1.5">
        {fields.map((f, i) => {
          const locked = LOCKED.has(f.key);
          return (
            <div
              key={f.key}
              className={cn(
                'flex items-center gap-2.5 rounded-lg border border-border/50 bg-card px-3 py-2 transition-colors',
                !f.enabled && 'opacity-60',
              )}
            >
              <div className="flex shrink-0 flex-col">
                <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0}
                  className="text-muted-foreground/40 transition-colors hover:text-foreground disabled:opacity-30">
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => onMove(i, 1)} disabled={i === fields.length - 1}
                  className="text-muted-foreground/40 transition-colors hover:text-foreground disabled:opacity-30">
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-sm font-medium">{f.label}</span>
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px] capitalize">{f.type}</Badge>
                  {f.required && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Required</Badge>}
                  {!f.system && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Custom</Badge>}
                  {locked && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" /> Always on
                    </span>
                  )}
                </div>
                <span className="block truncate text-[11px] text-muted-foreground">{f.key}</span>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button type="button" onClick={() => onToggleRequired(f)} disabled={locked}
                  title={f.required ? 'Make optional' : 'Make required'}
                  className={cn('rounded px-1.5 py-1 text-[10px] font-semibold transition-colors disabled:opacity-40',
                    f.required ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted')}>
                  REQ
                </button>
                <button type="button" onClick={() => onToggleEnabled(f)} disabled={locked}
                  title={f.enabled ? 'Hide field' : 'Show field'}
                  className={cn('flex h-7 w-7 items-center justify-center rounded transition-colors disabled:opacity-40',
                    f.enabled ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted')}>
                  {f.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
                <button type="button" onClick={() => onEdit(f.key)} title="Edit field"
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => onDelete(f.key)} disabled={f.system}
                  title={f.system ? 'Predefined fields can be hidden but not removed' : 'Remove field'}
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground">
                  <Trash className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ──────────────────────────── Design tab ──────────────────────────────── */
function DesignTab({ styles, onChange }: { styles: ContactFormStyles; onChange: (p: Partial<ContactFormStyles>) => void }) {
  const colors: { key: keyof ContactFormStyles; label: string }[] = [
    { key: 'accentColor', label: 'Accent' },
    { key: 'backgroundColor', label: 'Background' },
    { key: 'surfaceColor', label: 'Card surface' },
    { key: 'textColor', label: 'Text' },
    { key: 'buttonTextColor', label: 'Button text' },
    { key: 'borderColor', label: 'Border' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {colors.map((c) => (
          <div key={c.key} className="space-y-1.5">
            <Label>{c.label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={String(styles[c.key])}
                onChange={(e) => onChange({ [c.key]: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border border-input bg-transparent p-0.5"
              />
              <Input
                value={String(styles[c.key])}
                onChange={(e) => onChange({ [c.key]: e.target.value })}
                className="h-9 font-mono text-xs"
                maxLength={7}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="cf-font">Font</Label>
          <Select id="cf-font" value={styles.font} onChange={(e) => onChange({ font: e.target.value as ContactFormStyles['font'] })}>
            <option value="display">Display (League Spartan)</option>
            <option value="sans">Sans-serif (Inter)</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-layout">Field layout</Label>
          <Select id="cf-layout" value={styles.layout} onChange={(e) => onChange({ layout: e.target.value as ContactFormStyles['layout'] })}>
            <option value="two-column">Two columns</option>
            <option value="one-column">Single column</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-shadow">Shadow</Label>
          <Select id="cf-shadow" value={styles.shadow} onChange={(e) => onChange({ shadow: e.target.value as ContactFormStyles['shadow'] })}>
            <option value="none">None</option>
            <option value="sm">Small</option>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="cf-labelstyle">Field labels</Label>
          <Select id="cf-labelstyle" value={styles.labelStyle} onChange={(e) => onChange({ labelStyle: e.target.value as ContactFormStyles['labelStyle'] })}>
            <option value="placeholder">Inside field (placeholder)</option>
            <option value="top">Above field</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cf-btnstyle">Button style</Label>
          <Select id="cf-btnstyle" value={styles.buttonStyle} onChange={(e) => onChange({ buttonStyle: e.target.value as ContactFormStyles['buttonStyle'] })}>
            <option value="solid">Solid (accent fill)</option>
            <option value="outline">Outline</option>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <NumberField label="Width (px)" min={320} max={1200} step={10} value={styles.maxWidth}
          onChange={(n) => onChange({ maxWidth: n })} />
        <NumberField label="Padding (px)" min={0} max={64} value={styles.padding}
          onChange={(n) => onChange({ padding: n })} />
        <NumberField label="Corner radius (px)" min={0} max={32} value={styles.cornerRadius}
          onChange={(n) => onChange({ cornerRadius: n })} />
        <NumberField label="Border width (px)" min={0} max={8} value={styles.borderWidth}
          onChange={(n) => onChange({ borderWidth: n })} />
      </div>

      <button
        type="button"
        onClick={() => onChange({ showLogo: !styles.showLogo })}
        className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2.5 text-sm transition-colors hover:bg-muted"
      >
        <span className={cn('flex h-5 w-9 items-center rounded-full p-0.5 transition-colors', styles.showLogo ? 'bg-primary' : 'bg-muted-foreground/30')}>
          <span className={cn('h-4 w-4 rounded-full bg-white transition-transform', styles.showLogo && 'translate-x-4')} />
        </span>
        Show company logo above the form
      </button>
    </div>
  );
}

/* ──────────────────────────── Content tab ─────────────────────────────── */
function ContentTab({ content, onChange }: { content: ContactFormContent; onChange: (p: Partial<ContactFormContent>) => void }) {
  const setDetail = (i: number, patch: Partial<ContactFormContent['contactDetails'][number]>) =>
    onChange({ contactDetails: content.contactDetails.map((d, idx) => (idx === i ? { ...d, ...patch } : d)) });
  const addDetail = () => onChange({ contactDetails: [...content.contactDetails, { label: '', value: '', href: '' }] });
  const removeDetail = (i: number) => onChange({ contactDetails: content.contactDetails.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Eyebrow"><Input value={content.eyebrow} maxLength={80} onChange={(e) => onChange({ eyebrow: e.target.value })} /></Row>
        <Row label="Submit button label"><Input value={content.submitLabel} maxLength={60} onChange={(e) => onChange({ submitLabel: e.target.value })} /></Row>
      </div>
      <Row label="Heading"><Input value={content.heading} maxLength={200} onChange={(e) => onChange({ heading: e.target.value })} /></Row>
      <Row label="Intro"><Textarea rows={2} value={content.intro} onChange={(e) => onChange({ intro: e.target.value })} /></Row>
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Success heading"><Input value={content.successHeading} maxLength={120} onChange={(e) => onChange({ successHeading: e.target.value })} /></Row>
        <Row label="Success message"><Textarea rows={2} value={content.successMessage} onChange={(e) => onChange({ successMessage: e.target.value })} /></Row>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Contact details</Label>
          <Button type="button" variant="outline" size="sm" onClick={addDetail}><Plus className="mr-1.5 h-3.5 w-3.5" /> Add</Button>
        </div>
        {content.contactDetails.length === 0 && <p className="text-xs text-muted-foreground">No contact rows — none will be shown.</p>}
        {content.contactDetails.map((d, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] items-center gap-2">
            <Input placeholder="Label (e.g. Email)" value={d.label} onChange={(e) => setDetail(i, { label: e.target.value })} />
            <Input placeholder="Value" value={d.value} onChange={(e) => setDetail(i, { value: e.target.value })} />
            <Input placeholder="Link (mailto:/tel:/https:)" value={d.href} onChange={(e) => setDetail(i, { href: e.target.value })} />
            <button type="button" onClick={() => removeDetail(i)}
              className="flex h-9 w-9 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive">
              <Trash className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function NumberField({
  label, value, min, max, step = 1, onChange,
}: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Math.round(Number(e.target.value))))}
      />
    </div>
  );
}

/* ──────────────────────────── Embed tab ───────────────────────────────── */
function EmbedTab({
  published, token, snippet, copied, busy, dirty, allowedOrigins,
  onOriginsChange, onPublish, onUnpublish, onRegenerate, onCopy,
}: {
  published: boolean; token: string; snippet: string; copied: boolean; busy: boolean; dirty: boolean;
  allowedOrigins: string[];
  onOriginsChange: (arr: string[]) => void;
  onPublish: () => void; onUnpublish: () => void; onRegenerate: () => void; onCopy: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        <Globe className="h-4 w-4 text-primary" />
        <div className="mr-auto">
          <div className="flex items-center gap-2 text-sm font-medium">
            Status
            <Badge variant={published ? 'default' : 'secondary'}>{published ? 'Published' : 'Not published'}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {published ? 'Your form is live and embeddable.' : 'Publish to generate an embed snippet.'}
          </p>
        </div>
        {published ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onUnpublish}>Unpublish</Button>
        ) : (
          <Button type="button" size="sm" disabled={busy} onClick={onPublish}>
            <Rocket className="mr-1.5 h-3.5 w-3.5" /> Publish
          </Button>
        )}
      </div>

      {dirty && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Save your changes — the live form serves the last saved version.
        </div>
      )}

      {published && token && (
        <>
          <div className="space-y-1.5">
            <Label>Embed snippet</Label>
            <p className="text-[11px] text-muted-foreground">Paste this just before the closing &lt;/body&gt; tag on any website.</p>
            <div className="relative">
              <Textarea readOnly value={snippet} rows={2} className="pr-12 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={onCopy} title="Copy"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground">
                {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Token</Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={token} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onRegenerate}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
              </Button>
            </div>
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="cf-origins">Allowed domains</Label>
        <p className="text-[11px] text-muted-foreground">
          One hostname per line (e.g. <code className="text-[10px]">example.com</code>). The form will only accept
          submissions from these domains. Leave blank to allow any. Saved with “Save changes”.
        </p>
        <Textarea
          id="cf-origins"
          rows={3}
          className="font-mono text-xs"
          value={allowedOrigins.join('\n')}
          placeholder={'example.com\nwww.example.com'}
          onChange={(e) => onOriginsChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
        />
      </div>
    </div>
  );
}

/* ──────────────────────── Field editor sheet ──────────────────────────── */
function FieldEditorSheet({
  open, isNew, field, existingKeys, onClose, onSubmit,
}: {
  open: boolean;
  isNew: boolean;
  field: ContactFormField | null;
  existingKeys: string[];
  onClose: () => void;
  onSubmit: (field: ContactFormField) => void;
}) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ContactFormFieldType>('text');
  const [placeholder, setPlaceholder] = useState('');
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState('');
  const [fullWidth, setFullWidth] = useState(true);

  // Reset the form whenever it opens for a different target.
  useEffect(() => {
    if (!open) return;
    if (field) {
      setLabel(field.label);
      setType(field.type);
      setPlaceholder(field.placeholder);
      setRequired(field.required);
      setOptionsText((field.options ?? []).join('\n'));
      setFullWidth(field.fullWidth !== false);
    } else {
      setLabel(''); setType('text'); setPlaceholder(''); setRequired(false); setOptionsText(''); setFullWidth(true);
    }
  }, [open, field]);

  const isSystem = !!field?.system;
  const effectiveType = field && isSystem ? field.type : type;
  const widthApplies = effectiveType !== 'textarea' && effectiveType !== 'checkbox';
  const submit = () => {
    const trimmed = label.trim();
    if (!trimmed) { toast.error('Label is required.'); return; }
    const options = effectiveType === 'select' ? optionsText.split('\n').map((s) => s.trim()).filter(Boolean) : undefined;
    if (effectiveType === 'select' && (!options || options.length === 0)) { toast.error('Add at least one dropdown option.'); return; }
    const widthPatch = widthApplies && !fullWidth ? { fullWidth: false } : { fullWidth: true };

    if (field) {
      // Editing: keep key/type for system fields; allow type change for custom.
      onSubmit({ ...field, label: trimmed, placeholder, required, type: effectiveType, options, ...widthPatch });
    } else {
      const taken = new Set(existingKeys);
      onSubmit({ key: makeKey(trimmed, taken), type, label: trimmed, placeholder, required, enabled: true, options, system: false, ...widthPatch });
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent size="sm">
        <SheetHeader>
          <SheetTitle>{isNew ? 'Add custom field' : 'Edit field'}</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-4">
          <Row label="Label"><Input value={label} maxLength={200} autoFocus onChange={(e) => setLabel(e.target.value)} placeholder="e.g. How did you hear about us?" /></Row>
          <div className="space-y-1.5">
            <Label htmlFor="cf-fe-type">Type</Label>
            <Select id="cf-fe-type" value={type} disabled={isSystem} onChange={(e) => setType(e.target.value as ContactFormFieldType)}>
              {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
            {isSystem && <p className="text-[11px] text-muted-foreground">Predefined fields keep their type.</p>}
          </div>
          {type !== 'checkbox' && (
            <Row label="Placeholder"><Input value={placeholder} maxLength={200} onChange={(e) => setPlaceholder(e.target.value)} /></Row>
          )}
          {type === 'select' && (
            <Row label="Options (one per line)">
              <Textarea rows={4} value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={'Option A\nOption B'} />
            </Row>
          )}
          <button
            type="button"
            onClick={() => setRequired((r) => !r)}
            className="flex items-center gap-2.5 text-sm"
          >
            <span className={cn('flex h-5 w-9 items-center rounded-full p-0.5 transition-colors', required ? 'bg-primary' : 'bg-muted-foreground/30')}>
              <span className={cn('h-4 w-4 rounded-full bg-white transition-transform', required && 'translate-x-4')} />
            </span>
            Required field
          </button>
          {widthApplies && (
            <button
              type="button"
              onClick={() => setFullWidth((w) => !w)}
              className="flex items-center gap-2.5 text-sm"
            >
              <span className={cn('flex h-5 w-9 items-center rounded-full p-0.5 transition-colors', fullWidth ? 'bg-primary' : 'bg-muted-foreground/30')}>
                <span className={cn('h-4 w-4 rounded-full bg-white transition-transform', fullWidth && 'translate-x-4')} />
              </span>
              Full width (two-column layouts)
            </button>
          )}
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild><Button variant="ghost">Cancel</Button></SheetClose>
          <Button onClick={submit}><Check className="mr-2 h-4 w-4" /> {isNew ? 'Add field' : 'Save'}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
