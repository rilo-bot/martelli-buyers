import { useState, useMemo } from 'react';
import { useEmailTemplatesStore } from '@/stores/emailTemplatesStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/rich-editor';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Plus, Search, Mail, Send, Edit, Star, Sparkles, AlertTriangle, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sendBlast } from '@/lib/email';
import { usePermissions } from '@/lib/permissions';
import { dealVariables, interpolate, unresolvedVariables, hasRecipientVars, plainTextToHtml, htmlToPlainText } from '@/lib/templates';
import { catalogPlaceholderGroups, composePlaceholderGroups } from '@/lib/templateVariables';
import { emailTemplateAudience } from '@/types';
import type { EmailTemplateCategory, EmailRecipientType, AgentGeo } from '@/types';

const CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  welcome: 'Welcome',
  dd_request: 'DD Request',
  status_update: 'Status Update',
  requirement_blast: 'Req. Blast',
  thank_you: 'Thank You',
  post_settlement: 'Post Settlement',
  other: 'Other',
};

const CATEGORY_STYLES: Record<EmailTemplateCategory, string> = {
  welcome: 'bg-primary/8 text-primary border-primary/20',
  dd_request: 'bg-orange-500/8 text-orange-700 dark:text-orange-400 border-orange-500/20',
  status_update: 'bg-violet-500/8 text-violet-700 dark:text-violet-400 border-violet-500/20',
  requirement_blast: 'bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  thank_you: 'bg-rose-500/8 text-rose-700 dark:text-rose-400 border-rose-500/20',
  post_settlement: 'bg-teal-500/8 text-teal-700 dark:text-teal-400 border-teal-500/20',
  other: 'bg-muted text-muted-foreground border-border',
};

const GEO_OPTIONS: AgentGeo[] = ['East', 'West', 'North', 'Central'];

export default function EmailsPage() {
  const templates = useEmailTemplatesStore((s) => s.templates);
  const campaigns = useEmailTemplatesStore((s) => s.campaigns);
  const addTemplate = useEmailTemplatesStore((s) => s.addTemplate);
  const updateTemplate = useEmailTemplatesStore((s) => s.updateTemplate);
  const recordSentCampaign = useEmailTemplatesStore((s) => s.recordSentCampaign);
  const agents = useAgentsStore((s) => s.agents);
  const deals = useDealsStore((s) => s.deals);
  const { can } = usePermissions();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showBlastDialog, setShowBlastDialog] = useState(false);
  const [blasting, setBlasting] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: '', category: 'other' as EmailTemplateCategory, recipientType: 'client' as EmailRecipientType, subject: '', bodyHtml: '', variables: '',
  });

  const [blastForm, setBlastForm] = useState({
    dealId: '', templateId: '', geoFilter: [] as AgentGeo[], preferredOnly: false,
    subject: '', bodyHtml: '',
  });

  const filteredTemplates = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter((t) => {
      const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || t.category === categoryFilter;
      return matchesSearch && matchesCategory && t.isActive;
    });
  }, [templates, search, categoryFilter]);

  // Agents matching the audience filters, and the subset we can actually email.
  const targetedAgents = useMemo(
    () =>
      agents.filter((a) => {
        const matchesGeo = blastForm.geoFilter.length === 0 || blastForm.geoFilter.includes(a.geoTag);
        const matchesPreferred = !blastForm.preferredOnly || a.isPreferred;
        return matchesGeo && matchesPreferred;
      }),
    [agents, blastForm.geoFilter, blastForm.preferredOnly],
  );

  const recipients = useMemo(
    () =>
      targetedAgents
        .filter((a) => a.email.trim())
        .map((a) => ({ email: a.email.trim(), name: `${a.firstName} ${a.lastName}`.trim() })),
    [targetedAgents],
  );

  const missingEmailCount = targetedAgents.length - recipients.length;

  // Placeholders that won't be filled (excludes {{agentName}}, resolved per-recipient).
  const unresolved = useMemo(
    () => unresolvedVariables(`${blastForm.subject}\n${blastForm.bodyHtml}`),
    [blastForm.subject, blastForm.bodyHtml],
  );
  const personalizesPerAgent = useMemo(
    () => hasRecipientVars(`${blastForm.subject}\n${blastForm.bodyHtml}`),
    [blastForm.subject, blastForm.bodyHtml],
  );

  // Full catalog for authoring a reusable template (no record in context).
  const templatePlaceholders = useMemo(() => catalogPlaceholderGroups(), []);
  // Blast: live values from the linked campaign's deal; {{agentName}} is filled
  // per recipient by the server, so it's flagged rather than resolved here.
  const blastPlaceholders = useMemo(
    () => composePlaceholderGroups(dealVariables(deals.find((d) => d.id === blastForm.dealId)), ['agentName']),
    [deals, blastForm.dealId],
  );

  /** Fill subject/body from a template, interpolating the linked deal's data. */
  const applyTemplateAndDeal = (templateId: string, dealId: string) => {
    const template = templates.find((t) => t.id === templateId);
    const deal = deals.find((d) => d.id === dealId);
    const vars = dealVariables(deal);
    setBlastForm((f) => ({
      ...f,
      templateId,
      dealId,
      subject: template ? interpolate(template.subject, vars) : f.subject,
      bodyHtml: template ? interpolate(template.bodyHtml || plainTextToHtml(template.body), vars) : f.bodyHtml,
    }));
  };

  const openBlast = () => {
    setBlastForm({ dealId: '', templateId: '', geoFilter: [], preferredOnly: false, subject: '', bodyHtml: '' });
    setShowBlastDialog(true);
  };

  const openEdit = (id: string) => {
    const t = templates.find((tmpl) => tmpl.id === id);
    if (!t) return;
    setEditTemplateId(id);
    setTemplateForm({ name: t.name, category: t.category, recipientType: emailTemplateAudience(t), subject: t.subject, bodyHtml: t.bodyHtml || plainTextToHtml(t.body), variables: t.variables.join(', ') });
    setShowAddTemplate(true);
  };

  const openAdd = () => {
    setEditTemplateId(null);
    setTemplateForm({ name: '', category: 'other', recipientType: 'client', subject: '', bodyHtml: '', variables: '' });
    setShowAddTemplate(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.subject.trim()) {
      toast.error('Template name and subject are required.');
      return;
    }
    const data = {
      name: templateForm.name.trim(), category: templateForm.category, recipientType: templateForm.recipientType,
      subject: templateForm.subject.trim(),
      // Keep a plain-text `body` in sync for card previews + the text/alt part.
      body: htmlToPlainText(templateForm.bodyHtml), bodyHtml: templateForm.bodyHtml,
      variables: templateForm.variables.split(',').map((v) => v.trim()).filter(Boolean),
      isActive: true,
    };
    if (editTemplateId) {
      updateTemplate(editTemplateId, data);
    } else {
      addTemplate(data);
    }
    setShowAddTemplate(false);
  };

  const handleSendBlast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!blastForm.templateId) {
      toast.error('Please select a template.');
      return;
    }
    if (!blastForm.subject.trim()) {
      toast.error('Subject line is required.');
      return;
    }
    if (recipients.length === 0) {
      toast.error('No targeted agents have an email address on file.');
      return;
    }

    setBlasting(true);
    try {
      const result = await sendBlast(
        recipients,
        blastForm.subject.trim(),
        htmlToPlainText(blastForm.bodyHtml),
        {
          dealId: blastForm.dealId,
          templateId: blastForm.templateId,
          agentGeoFilter: blastForm.geoFilter,
          preferredOnly: blastForm.preferredOnly,
        },
        blastForm.bodyHtml,
      );
      // Server already persisted the record atomically with the send.
      if (result.campaign) recordSentCampaign(result.campaign);
      setBlastForm({ dealId: '', templateId: '', geoFilter: [], preferredOnly: false, subject: '', bodyHtml: '' });
      setShowBlastDialog(false);
      toast.success(
        result.failed > 0
          ? `Blast sent to ${result.sent} agents (${result.failed} failed).`
          : `Blast sent to ${result.sent} agents.`,
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send blast.');
    } finally {
      setBlasting(false);
    }
  };

  const toggleGeoFilter = (geo: AgentGeo) => {
    setBlastForm((f) => ({
      ...f,
      geoFilter: f.geoFilter.includes(geo)
        ? f.geoFilter.filter((g) => g !== geo)
        : [...f.geoFilter, geo],
    }));
  };

  const previewTemplate = previewId ? templates.find((t) => t.id === previewId) : null;
  const activeTemplateCount = useMemo(() => templates.filter((t) => t.isActive).length, [templates]);

  // Category stats
  const categoryStats = useMemo(() => {
    return (Object.keys(CATEGORY_LABELS) as EmailTemplateCategory[]).map((cat) => ({
      cat,
      count: templates.filter((t) => t.category === cat && t.isActive).length,
    }));
  }, [templates]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="section-eyebrow mb-1.5">Communications</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">Reusable branded templates for every stage of the buyer journey.</p>
        </div>
        <div className="flex gap-2.5">
          {can('emails:send') && (
            <Button variant="outline" onClick={openBlast} className="h-9 shadow-sm">
              <Send className="mr-2 h-3.5 w-3.5" />
              Agent Blast
            </Button>
          )}
          {can('emails:create') && (
            <Button onClick={openAdd} className="h-9 shadow-md shadow-primary/25">
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Template
            </Button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-4 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Templates', value: activeTemplateCount, accent: 'bg-primary/6 border-primary/15', text: 'text-primary' },
          { label: 'Campaigns Sent', value: campaigns.length, accent: 'bg-emerald-500/6 border-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Agent Network', value: agents.length, accent: 'bg-violet-500/6 border-violet-500/15', text: 'text-violet-700 dark:text-violet-400' },
          { label: 'Preferred Agents', value: agents.filter((a) => a.isPreferred).length, accent: 'bg-amber-500/6 border-amber-500/15', text: 'text-amber-700 dark:text-amber-400' },
        ].map((s) => (
          <Card key={s.label} className={cn('border kpi-card', s.accent)}>
            <CardContent className="pt-4 pb-4 px-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold leading-tight">{s.label}</p>
              <p className={cn('text-2xl font-bold mt-1.5 tabular-nums', s.text)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="templates">
        <TabsList className="h-10">
          <TabsTrigger value="templates" className="text-sm">Templates ({activeTemplateCount})</TabsTrigger>
          <TabsTrigger value="campaigns" className="text-sm">Sent Campaigns ({campaigns.length})</TabsTrigger>
        </TabsList>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="mt-4 space-y-4">
          {/* Category filter pills */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setCategoryFilter('')}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                !categoryFilter
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card hover:bg-muted text-muted-foreground'
              )}
            >
              All ({activeTemplateCount})
            </button>
            {categoryStats.map(({ cat, count }) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(categoryFilter === cat ? '' : cat)}
                className={cn(
                  'flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border',
                  categoryFilter === cat
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card hover:bg-muted text-muted-foreground'
                )}
              >
                {CATEGORY_LABELS[cat]} ({count})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search templates..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
            </div>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="w-48 h-10">
              <option value="">All categories</option>
              {(Object.keys(CATEGORY_LABELS) as EmailTemplateCategory[]).map((cat) => (
                <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
              ))}
            </Select>
          </div>

          {filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-5">
                <Mail className="h-8 w-8 text-primary/40" />
              </div>
              <h3 className="text-lg font-bold">No templates found</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                {templates.length === 0
                  ? 'Create your first email template to start building your communication library.'
                  : 'No templates match your filters — try adjusting your selection.'}
              </p>
              <Button className="mt-5 shadow-md shadow-primary/20" onClick={openAdd}>
                <Plus className="mr-2 h-4 w-4" />Create Template
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="group border-border/70 card-interactive bg-card">
                  <CardHeader className="pb-3 px-5 pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-[15px] font-bold leading-tight">{template.name}</CardTitle>
                      <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-bold shrink-0 border', CATEGORY_STYLES[template.category])}>
                        {CATEGORY_LABELS[template.category]}
                      </span>
                    </div>
                    <CardDescription className="text-xs mt-1 truncate">{template.subject}</CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5">
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{template.body}</p>
                    {template.variables.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {template.variables.slice(0, 3).map((v) => (
                          <span key={v} className="text-[10px] bg-primary/8 text-primary px-1.5 py-0.5 rounded-md font-mono">{`{{${v}}}`}</span>
                        ))}
                        {template.variables.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{template.variables.length - 3} more</span>
                        )}
                      </div>
                    )}
                    <div className="flex gap-2 mt-3 border-t border-border/50 pt-3">
                      <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => setPreviewId(template.id)}>
                        Preview
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 px-2.5" onClick={() => openEdit(template.id)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* CAMPAIGNS */}
        <TabsContent value="campaigns" className="mt-4">
          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-5">
                <Send className="h-8 w-8 text-primary/40" />
              </div>
              <h3 className="text-lg font-bold">No campaigns sent yet</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Send your first agent requirement blast to start reaching your network.
              </p>
              {can('emails:send') && (
                <Button className="mt-5 shadow-md shadow-primary/20" onClick={openBlast}>
                  <Send className="mr-2 h-4 w-4" />Send Agent Blast
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 overflow-hidden shadow-sm">
              <div className="data-table-header px-5 py-3 grid grid-cols-[1fr_auto_auto]">
                <span>Subject</span>
                <span>Recipients</span>
                <span className="text-right">Sent</span>
              </div>
              {[...campaigns].reverse().map((campaign, i) => {
                const tplName = templates.find((t) => t.id === campaign.templateId)?.name;
                return (
                  <div
                    key={campaign.id}
                    className={cn('grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3.5 data-table-row', i === campaigns.length - 1 && 'border-b-0')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="hidden sm:flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary border border-primary/15">
                        <Send className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{campaign.subject}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {tplName ? `${tplName} · ` : ''}
                          {campaign.agentGeoFilter.length > 0 ? campaign.agentGeoFilter.join(', ') : 'All regions'}
                          {campaign.preferredOnly ? ' · preferred only' : ''}
                        </p>
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold bg-primary/8 text-primary border border-primary/20">
                      {campaign.recipientCount} agents
                    </span>
                    <span className="text-xs text-muted-foreground text-right tabular-nums">
                      {new Date(campaign.sentAt).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Template Dialog */}
      <Sheet open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <SheetContent size="xl">
          <SheetHeader>
            <SheetTitle>{editTemplateId ? 'Edit Template' : 'New Email Template'}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSaveTemplate} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tplName">Template name *</Label>
                <Input id="tplName" value={templateForm.name} onChange={(e) => setTemplateForm((f) => ({ ...f, name: e.target.value }))} placeholder="Welcome - New Client" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tplCat">Category</Label>
                <Select id="tplCat" value={templateForm.category} onChange={(e) => setTemplateForm((f) => ({ ...f, category: e.target.value as EmailTemplateCategory }))}>
                  {(Object.keys(CATEGORY_LABELS) as EmailTemplateCategory[]).map((cat) => (
                    <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tplAudience">Send to</Label>
              <Select id="tplAudience" value={templateForm.recipientType} onChange={(e) => setTemplateForm((f) => ({ ...f, recipientType: e.target.value as EmailRecipientType }))}>
                <option value="client">Client</option>
                <option value="agent">Agent</option>
              </Select>
              <p className="text-xs text-muted-foreground">Determines who is pre-selected as the recipient when this template is used.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tplSubject">Subject *</Label>
              <Input id="tplSubject" value={templateForm.subject} onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Welcome to Martelli Buyers, {{clientName}}!" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tplBody">Body</Label>
              <RichTextEditor
                value={templateForm.bodyHtml}
                onChange={(html) => setTemplateForm((f) => ({ ...f, bodyHtml: html }))}
                placeholders={templatePlaceholders}
                placeholder="Email body. Use the toolbar to format and the placeholder menu to insert variables."
              />
              <p className="text-xs text-muted-foreground">Your logo, brand colour and signature are applied automatically on send.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tplVars">Variables (comma-separated)</Label>
              <Input id="tplVars" value={templateForm.variables} onChange={(e) => setTemplateForm((f) => ({ ...f, variables: e.target.value }))} placeholder="clientName, consultantName, budget" />
              <p className="text-xs text-muted-foreground">List variable names used in subject/body (without curly braces)</p>
            </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
              <Button type="submit" disabled={!templateForm.name.trim() || !templateForm.subject.trim()} className="shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />{editTemplateId ? 'Save Changes' : 'Create Template'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Agent Blast Dialog */}
      <Sheet open={showBlastDialog} onOpenChange={setShowBlastDialog}>
        <SheetContent size="xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Send className="h-3.5 w-3.5" />
              </span>
              Send Agent Requirement Blast
            </SheetTitle>
            <SheetDescription>
              Personalised per agent — each recipient&apos;s name is filled in automatically. Review the message before sending.
            </SheetDescription>
          </SheetHeader>
          <form onSubmit={handleSendBlast} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-5">
            {/* Step 1 — Source */}
            <div className="space-y-3">
              <p className="section-eyebrow">1 · Source</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="blastTemplate">Template *</Label>
                  <Select
                    id="blastTemplate"
                    value={blastForm.templateId}
                    onChange={(e) => applyTemplateAndDeal(e.target.value, blastForm.dealId)}
                  >
                    <option value="">Select a template</option>
                    {templates.filter((t) => t.isActive).map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="blastDeal">Linked campaign (optional)</Label>
                  <Select
                    id="blastDeal"
                    value={blastForm.dealId}
                    onChange={(e) => applyTemplateAndDeal(blastForm.templateId, e.target.value)}
                  >
                    <option value="">No campaign linked</option>
                    {deals.map((d) => <option key={d.id} value={d.id}>{d.clientName}</option>)}
                  </Select>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Linking a campaign auto-fills budget, suburbs, property type &amp; requirements.
              </p>
            </div>

            {/* Step 2 — Audience */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <p className="section-eyebrow">2 · Audience</p>
              <div className="space-y-2">
                <Label>Target regions <span className="font-normal text-muted-foreground">(empty = all)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {GEO_OPTIONS.map((geo) => (
                    <button
                      key={geo}
                      type="button"
                      onClick={() => toggleGeoFilter(geo)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-semibold border transition-all',
                        blastForm.geoFilter.includes(geo)
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'border-border hover:bg-muted text-muted-foreground'
                      )}
                    >
                      {geo} ({agents.filter((a) => a.geoTag === geo).length})
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer px-3 py-2.5 rounded-lg border border-border hover:bg-muted transition-colors">
                <input
                  type="checkbox"
                  checked={blastForm.preferredOnly}
                  onChange={(e) => setBlastForm((f) => ({ ...f, preferredOnly: e.target.checked }))}
                  className="rounded"
                />
                <Star className="h-4 w-4 text-amber-400" />
                <span>Preferred agents only</span>
              </label>
            </div>

            {/* Step 3 — Message */}
            <div className="space-y-3 border-t border-border/60 pt-4">
              <p className="section-eyebrow">3 · Message</p>
              {!blastForm.templateId ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center">
                  <Mail className="mx-auto h-6 w-6 text-muted-foreground/50" />
                  <p className="mt-2 text-sm text-muted-foreground">Select a template above to compose your message.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="blastSubject">Subject *</Label>
                    <Input
                      id="blastSubject"
                      value={blastForm.subject}
                      onChange={(e) => setBlastForm((f) => ({ ...f, subject: e.target.value }))}
                      placeholder="Subject line"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="blastBody">Body</Label>
                    <RichTextEditor
                      value={blastForm.bodyHtml}
                      onChange={(html) => setBlastForm((f) => ({ ...f, bodyHtml: html }))}
                      placeholders={blastPlaceholders}
                      placeholder="Compose your message…"
                    />
                  </div>
                  {personalizesPerAgent && (
                    <p className="flex items-center gap-1.5 text-xs text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span><code className="font-mono">{'{{agentName}}'}</code> is replaced with each agent&apos;s name on send.</span>
                    </p>
                  )}
                  {unresolved.length > 0 && (
                    <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/8 px-3.5 py-2.5">
                      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div className="text-xs text-amber-800 dark:text-amber-300">
                        <span className="font-semibold">{unresolved.length} placeholder{unresolved.length > 1 ? 's' : ''} won&apos;t be filled.</span>{' '}
                        Link a campaign or edit the text to replace:{' '}
                        <span className="font-mono">{unresolved.map((v) => `{{${v}}}`).join(', ')}</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Recipient summary + send */}
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </span>
              <div className="text-sm leading-tight">
                <p>
                  <span className="font-bold text-primary text-lg tabular-nums">{recipients.length}</span>
                  <span className="text-muted-foreground ml-1.5">agent{recipients.length === 1 ? '' : 's'} will receive this email</span>
                </p>
                {missingEmailCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {missingEmailCount} matched agent{missingEmailCount === 1 ? '' : 's'} skipped — no email on file
                  </p>
                )}
              </div>
            </div>

            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
              <Button
                type="submit"
                disabled={!blastForm.templateId || !blastForm.subject.trim() || recipients.length === 0 || blasting}
                className="shadow-sm shadow-primary/20"
              >
                <Send className="mr-2 h-4 w-4" />
                {blasting ? 'Sending…' : `Send to ${recipients.length} Agent${recipients.length === 1 ? '' : 's'}`}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Preview Dialog */}
      <Dialog open={!!previewId} onOpenChange={(open) => { if (!open) setPreviewId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <div className="space-y-4">
              <div className="rounded-xl bg-muted/40 border border-border p-5 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1.5">Subject</p>
                  <p className="text-sm font-semibold">{previewTemplate.subject}</p>
                </div>
                <div className="h-px bg-border" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Body</p>
                  <div
                    className="rich-editor-content text-sm text-foreground leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: previewTemplate.bodyHtml || plainTextToHtml(previewTemplate.body) }}
                  />
                </div>
              </div>
              {previewTemplate.variables.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">Variables</p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewTemplate.variables.map((v) => (
                      <span key={v} className="text-xs bg-primary/8 text-primary px-2.5 py-0.5 rounded-full font-mono border border-primary/20">{`{{${v}}}`}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewId(null)}>Close</Button>
            {previewTemplate && (
              <Button onClick={() => { openEdit(previewTemplate.id); setPreviewId(null); }} className="shadow-sm shadow-primary/20">
                <Edit className="mr-2 h-4 w-4" />Edit Template
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}