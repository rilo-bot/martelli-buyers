import { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/ui/rich-editor';
import { useEmailTemplatesStore } from '@/stores/emailTemplatesStore';
import { sendEmail } from '@/lib/email';
import { plainTextToHtml, htmlToPlainText } from '@/lib/templates';
import { cn } from '@/lib/utils';
import { Mail, Search } from 'lucide-react';
import { toast } from 'sonner';
import { emailTemplateAudience } from '@/types';
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

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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
  const [bodyHtml, setBodyHtml] = useState('');
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
      setBodyHtml('');
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

  // Build the interpolation variable map for a chosen recipient. The recipient's
  // name fills the variable matching its role ({{agentName}} for agents,
  // {{clientName}} for clients) so an Agent Blast greets the agent, not the
  // client. Caller-supplied `variables` (e.g. the deal's actual clientName) win.
  const buildVars = (chosen?: EmailRecipient): Record<string, string> => {
    const extra: Record<string, string> = {};
    if (chosen) {
      if (chosen.type === 'agent') extra['agentName'] = chosen.name;
      else extra['clientName'] = chosen.name;
    }
    return { ...extra, ...variables };
  };

  // Choose a recipient matching a template's intended audience, preferring the
  // current selection when it already matches, then the first recipient of the
  // right type, then the default if it matches. Returns undefined when no
  // recipient of the required audience exists — we deliberately do NOT fall back
  // to a wrong-audience recipient (e.g. addressing an Agent Blast to the client).
  const pickRecipientForTemplate = (audience: 'client' | 'agent'): EmailRecipient | undefined => {
    const current = recipients.find((r) => r.id === recipientId);
    if (current && current.type === audience) return current;
    const match = recipients.find((r) => r.type === audience);
    if (match) return match;
    if (defaultRecipient?.type === audience) return defaultRecipient;
    return undefined;
  };

  const handleSelectTemplate = (templateId: string) => {
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    const chosen = pickRecipientForTemplate(emailTemplateAudience(tpl));
    // Clear the recipient when none matches the audience, so the user is
    // prompted to pick/enter the right one instead of silently emailing the
    // wrong party.
    setRecipientId(chosen?.id ?? '');
    setTo(chosen?.email ?? '');
    const vars = buildVars(chosen);
    setSubject(interpolate(tpl.subject, vars));
    setBodyHtml(interpolate(tpl.bodyHtml || plainTextToHtml(tpl.body), vars));
    setStep('compose');
  };

  const handleRecipientChange = (newId: string) => {
    setRecipientId(newId);
    const chosen = recipients.find((r) => r.id === newId);
    if (chosen) setTo(chosen.email);
    // Re-interpolate with the updated recipient name
    const tpl = templates.find((t) => t.id === selectedTemplateId);
    if (tpl) {
      const vars = buildVars(chosen);
      setSubject(interpolate(tpl.subject, vars));
      setBodyHtml(interpolate(tpl.bodyHtml || plainTextToHtml(tpl.body), vars));
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!to.trim()) {
      toast.error('Please enter a recipient email address.');
      return;
    }
    if (!isValidEmail(to)) {
      toast.error('Please enter a valid email address.');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required.');
      return;
    }
    if (unresolvedVars.length > 0) {
      toast.error('Replace the unfilled {{placeholders}} before sending.');
      return;
    }
    setSending(true);
    try {
      await sendEmail(to.trim(), subject, htmlToPlainText(bodyHtml), bodyHtml);
      toast.success(`Email sent to ${to}`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  // An agent-directed template was chosen but there are no agent recipients to
  // address it to (e.g. no agents in the system yet).
  const missingAudience =
    !!selectedTemplate &&
    emailTemplateAudience(selectedTemplate) === 'agent' &&
    !recipients.some((r) => r.type === 'agent');

  /* ─── Missing variable highlighting ──────────────────────────────── */
  const unresolvedVars = useMemo(() => {
    const found = new Set<string>();
    const combined = subject + ' ' + bodyHtml;
    const matches = combined.matchAll(/\{\{(\w+)\}\}/g);
    for (const m of matches) found.add(m[1]);
    return Array.from(found);
  }, [subject, bodyHtml]);

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
            <SheetBody className="flex min-h-0 flex-col gap-4 overflow-hidden">
            {availableTemplates.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
                <Mail className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium">No email templates found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Visit the Emails page to create and manage templates.
                </p>
              </div>
            ) : (
              <>
                {/* Search + category filter */}
                <div className="flex shrink-0 gap-2">
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

                {/* Result count */}
                <p className="shrink-0 text-xs text-muted-foreground">
                  {filteredTemplates.length}{' '}
                  {filteredTemplates.length === 1 ? 'template' : 'templates'}
                </p>

                {/* Template list */}
                {filteredTemplates.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-6 text-center">
                    <Search className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No templates match your search.
                    </p>
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 -mr-1">
                    {filteredTemplates.map((tpl) => (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => handleSelectTemplate(tpl.id)}
                        className={cn(
                          'w-full text-left rounded-xl border border-border/60 px-4 py-3',
                          'hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm',
                          'focus:outline-none focus-visible:border-primary/60 focus-visible:ring-2 focus-visible:ring-ring',
                          'transition-all group'
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
            <SheetFooter className="sm:justify-start">
              <SheetClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
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

            {/* Agent-directed template with no agent recipients available */}
            {missingAudience && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-900/10 px-3 py-2.5">
                <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                  This template is addressed to <strong>agents</strong>, but no agents are available to select.
                  Add agents on the Agents page, or enter an agent's email below.
                </p>
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
                aria-invalid={!!to.trim() && !isValidEmail(to)}
                aria-describedby="emailTo-error"
              />
              {!!to.trim() && !isValidEmail(to) && (
                <p id="emailTo-error" role="alert" className="text-xs text-destructive">
                  Enter a valid email address.
                </p>
              )}
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
              <RichTextEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Write your message…" />
              <p className="text-xs text-muted-foreground">Your company logo, colours and signature are added automatically when the email is sent.</p>
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
              <Button
                type="submit"
                loading={sending}
                disabled={!to.trim() || !subject.trim() || !isValidEmail(to) || unresolvedVars.length > 0}
              >
                {!sending && <Mail className="mr-1.5 h-3.5 w-3.5" />}
                {sending ? 'Sending…' : 'Send Email'}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}