import { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useEmailTemplatesStore } from '@/stores/emailTemplatesStore';
import { sendEmail } from '@/lib/email';
import { cn } from '@/lib/utils';
import { Mail, Search } from 'lucide-react';
import { toast } from 'sonner';
import type { EmailTemplateCategory } from '@/types';

/* ─── Types ─────────────────────────────────────────────────────────── */

export interface EmailRecipient {
  id: string;
  name: string;
  email: string;
  type: 'client' | 'agent';
}

export interface SendEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-selected recipient – dialog still lets user change */
  defaultRecipient?: EmailRecipient;
  /** All possible recipients to choose from */
  recipients: EmailRecipient[];
  /** Variable values to pre-fill in template body/subject */
  variables?: Record<string, string>;
  /** Restrict template categories shown */
  categoryFilter?: EmailTemplateCategory[];
  /** Context label shown in header e.g. "Alex Johnson" */
  contextLabel?: string;
}

/* ─── Category labels ────────────────────────────────────────────────── */

const CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  welcome: 'Welcome',
  dd_request: 'Due Diligence',
  status_update: 'Status Update',
  requirement_blast: 'Agent Blast',
  thank_you: 'Thank You',
  post_settlement: 'Post-Settlement',
  other: 'Other',
};

/* ─── Variable interpolation ─────────────────────────────────────────── */

function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/* ─── Main component ─────────────────────────────────────────────────── */

export function SendEmailDialog({
  open,
  onOpenChange,
  defaultRecipient,
  recipients,
  variables = {},
  categoryFilter,
  contextLabel,
}: SendEmailDialogProps) {
  const templates = useEmailTemplatesStore((s) => s.templates);

  const [step, setStep] = useState<'pick' | 'compose'>('pick');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<EmailTemplateCategory | ''>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');

  // Compose state
  const [recipientId, setRecipientId] = useState(defaultRecipient?.id ?? '');
  const [to, setTo] = useState(defaultRecipient?.email ?? '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep('pick');
      setSearch('');
      setSelectedCategory('');
      setSelectedTemplateId('');
      setRecipientId(defaultRecipient?.id ?? '');
      setTo(defaultRecipient?.email ?? '');
      setSubject('');
      setBody('');
    }
  }, [open, defaultRecipient?.id, defaultRecipient?.email]);

  // All active templates, optionally filtered by category prop
  const availableTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (!t.isActive) return false;
      if (categoryFilter && categoryFilter.length > 0 && !categoryFilter.includes(t.category)) return false;
      return true;
    });
  }, [templates, categoryFilter]);

  // Local filter by search + category picker
  const filteredTemplates = useMemo(() => {
    const q = search.toLowerCase();
    return availableTemplates.filter((t) => {
      const matchesSearch =
        !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
      const matchesCategory = !selectedCategory || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [availableTemplates, search, selectedCategory]);

  // Unique categories present in available templates
  const availableCategories = useMemo(() => {
    const cats = new Set(availableTemplates.map((t) => t.category));
    return Array.from(cats) as EmailTemplateCategory[];
  }, [availableTemplates]);

  // Build recipient variable map
  const resolvedVars = useMemo(() => {
    const chosen = recipients.find((r) => r.id === recipientId) ?? defaultRecipient;
    const extra: Record<string, string> = {};
    if (chosen) {
      extra['clientName'] = chosen.name;
      extra['agentName'] = chosen.name;
    }
    return { ...extra, ...variables };
  }, [recipientId, recipients, defaultRecipient, variables]);

  const handleSelectTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setSubject(interpolate(tpl.subject, resolvedVars));
    setBody(interpolate(tpl.body, resolvedVars));
    const chosen = recipients.find((r) => r.id === recipientId) ?? defaultRecipient;
    if (chosen) setTo(chosen.email);
    setStep('compose');
  };

  const handleRecipientChange = (newId: string) => {
    setRecipientId(newId);
    const chosen = recipients.find((r) => r.id === newId);
    if (chosen) {
      setTo(chosen.email);
      // Re-interpolate with updated recipient name
      const tpl = templates.find((t) => t.id === selectedTemplateId);
      if (tpl) {
        const vars: Record<string, string> = { clientName: chosen.name, agentName: chosen.name, ...variables };
        setSubject(interpolate(tpl.subject, vars));
        setBody(interpolate(tpl.body, vars));
      }
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      toast.error('Please enter a recipient email address.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    setSending(true);
    try {
      await sendEmail(to.trim(), subject, body);
      toast.success(`Email sent to ${to}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  /* ─── Missing variable highlighting ──────────────────────────────── */
  const unresolvedVars = useMemo(() => {
    const found = new Set<string>();
    const combined = subject + ' ' + body;
    const matches = combined.matchAll(/\{\{(\w+)\}\}/g);
    for (const m of matches) found.add(m[1]);
    return Array.from(found);
  }, [subject, body]);

  /* ─── Render ──────────────────────────────────────────────────────── */

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {step === 'pick' ? 'Choose Email Template' : 'Compose Email'}
            {contextLabel && (
              <span className="text-sm font-normal text-muted-foreground ml-1">
                — {contextLabel}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* ── Step 1: Template picker ── */}
        {step === 'pick' && (
          <div className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
            {availableTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No email templates found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Visit the Emails page to create and manage templates.
                </p>
              </div>
            ) : (
              <>
                {/* Search + category filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search templates…"
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                  {availableCategories.length > 1 && (
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as EmailTemplateCategory | '')}
                      className={cn(
                        'h-9 px-3 rounded-lg border border-input bg-background text-sm',
                        'focus:outline-none focus:ring-2 focus:ring-ring'
                      )}
                    >
                      <option value="">All categories</option>
                      {availableCategories.map((c) => (
                        <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Template list */}
                {filteredTemplates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No templates match your search.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                    {filteredTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tpl.id)}
                        className={cn(
                          'w-full text-left rounded-xl border border-border/60 px-4 py-3',
                          'hover:border-primary/40 hover:bg-muted/30 transition-all group'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold group-hover:text-primary transition-colors truncate">
                              {tpl.name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {tpl.subject}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2 opacity-75">
                              {tpl.body.split('\n')[0]}
                            </p>
                          </div>
                          <Badge variant="secondary" className="text-[10px] shrink-0">
                            {CATEGORY_LABELS[tpl.category]}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            </SheetBody>
            <SheetFooter>
              <SheetClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </SheetClose>
            </SheetFooter>
          </div>
        )}

        {/* ── Step 2: Compose ── */}
        {step === 'compose' && (
          <form onSubmit={handleSend} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
            {/* Template badge + back */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep('pick')}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                ← Change template
              </button>
              {selectedTemplate && (
                <Badge variant="secondary" className="text-xs">
                  {selectedTemplate.name}
                </Badge>
              )}
            </div>

            {/* Recipient selector */}
            {recipients.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="recipient">Send To</Label>
                <select
                  id="recipient"
                  value={recipientId}
                  onChange={(e) => handleRecipientChange(e.target.value)}
                  className={cn(
                    'w-full h-9 px-3 rounded-lg border border-input bg-background text-sm',
                    'focus:outline-none focus:ring-2 focus:ring-ring'
                  )}
                >
                  <option value="">— Select recipient —</option>
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.type === 'agent' ? 'Agent: ' : 'Client: '}
                      {r.name} ({r.email})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* To address (editable) */}
            <div className="space-y-1.5">
              <Label htmlFor="emailTo">Recipient Email *</Label>
              <Input
                id="emailTo"
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="recipient@example.com"
              />
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <Label htmlFor="emailSubject">Subject *</Label>
              <Input
                id="emailSubject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject…"
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <Label htmlFor="emailBody">Message</Label>
              <Textarea
                id="emailBody"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                className="font-mono text-xs leading-relaxed resize-y"
              />
            </div>

            {/* Unresolved variable warning */}
            {unresolvedVars.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-3 py-2.5">
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium mb-1">
                  Unfilled placeholders detected — please replace before sending:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {unresolvedVars.map((v) => (
                    <code
                      key={v}
                      className="text-[10px] bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded font-mono text-amber-800 dark:text-amber-300"
                    >
                      {`{{${v}}}`}
                    </code>
                  ))}
                </div>
              </div>
            )}

            </SheetBody>
            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => setStep('pick')}>
                Back
              </Button>
              <Button type="submit" disabled={sending || !to.trim() || !subject.trim()}>
                <Mail className="mr-1.5 h-3.5 w-3.5" />
                {sending ? 'Sending…' : 'Send Email'}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}