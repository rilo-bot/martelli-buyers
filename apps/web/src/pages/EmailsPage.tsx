import { useState, useMemo } from 'react';
import { useEmailTemplatesStore } from '@/stores/emailTemplatesStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Search, Mail, Send, Edit, Star, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { sendBlast } from '@/lib/email';
import type { EmailTemplateCategory, AgentGeo } from '@/types';

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
  const addCampaign = useEmailTemplatesStore((s) => s.addCampaign);
  const agents = useAgentsStore((s) => s.agents);
  const deals = useDealsStore((s) => s.deals);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showAddTemplate, setShowAddTemplate] = useState(false);
  const [showBlastDialog, setShowBlastDialog] = useState(false);
  const [blasting, setBlasting] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [templateForm, setTemplateForm] = useState({
    name: '', category: 'other' as EmailTemplateCategory, subject: '', body: '', variables: '',
  });

  const [blastForm, setBlastForm] = useState({
    dealId: '', templateId: '', geoFilter: [] as AgentGeo[], preferredOnly: false, customBody: '',
  });

  const filteredTemplates = useMemo(() => {
    const q = search.toLowerCase();
    return templates.filter((t) => {
      const matchesSearch = !q || t.name.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q);
      const matchesCategory = !categoryFilter || t.category === categoryFilter;
      return matchesSearch && matchesCategory && t.isActive;
    });
  }, [templates, search, categoryFilter]);

  const blastAgentCount = useMemo(() => {
    return agents.filter((a) => {
      const matchesGeo = blastForm.geoFilter.length === 0 || blastForm.geoFilter.includes(a.geoTag);
      const matchesPreferred = !blastForm.preferredOnly || a.isPreferred;
      return matchesGeo && matchesPreferred;
    }).length;
  }, [agents, blastForm.geoFilter, blastForm.preferredOnly]);

  const openEdit = (id: string) => {
    const t = templates.find((tmpl) => tmpl.id === id);
    if (!t) return;
    setEditTemplateId(id);
    setTemplateForm({ name: t.name, category: t.category, subject: t.subject, body: t.body, variables: t.variables.join(', ') });
    setShowAddTemplate(true);
  };

  const openAdd = () => {
    setEditTemplateId(null);
    setTemplateForm({ name: '', category: 'other', subject: '', body: '', variables: '' });
    setShowAddTemplate(true);
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateForm.name.trim() || !templateForm.subject.trim()) {
      toast.error('Template name and subject are required.');
      return;
    }
    const data = {
      name: templateForm.name.trim(), category: templateForm.category,
      subject: templateForm.subject.trim(), body: templateForm.body.trim(),
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
    const template = templates.find((t) => t.id === blastForm.templateId);
    if (!template) return;

    // Resolve the targeted agents and keep only those with a valid email.
    const recipients = agents
      .filter((a) => {
        const matchesGeo = blastForm.geoFilter.length === 0 || blastForm.geoFilter.includes(a.geoTag);
        const matchesPreferred = !blastForm.preferredOnly || a.isPreferred;
        return matchesGeo && matchesPreferred;
      })
      .filter((a) => a.email.trim())
      .map((a) => ({ email: a.email.trim(), name: `${a.firstName} ${a.lastName}`.trim() }));

    if (recipients.length === 0) {
      toast.error('No targeted agents have an email address on file.');
      return;
    }

    const body = blastForm.customBody || template.body;
    setBlasting(true);
    try {
      const result = await sendBlast(recipients, template.subject, body);
      // Record the campaign with the count actually delivered.
      await addCampaign({
        dealId: blastForm.dealId,
        templateId: blastForm.templateId,
        subject: template.subject,
        body,
        recipientType: 'agents',
        agentGeoFilter: blastForm.geoFilter,
        preferredOnly: blastForm.preferredOnly,
        recipientCount: result.sent,
        sentAt: new Date().toISOString(),
        status: 'sent',
      });
      setBlastForm({ dealId: '', templateId: '', geoFilter: [], preferredOnly: false, customBody: '' });
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
          <Button variant="outline" onClick={() => setShowBlastDialog(true)} className="h-9 shadow-sm">
            <Send className="mr-2 h-3.5 w-3.5" />
            Agent Blast
          </Button>
          <Button onClick={openAdd} className="h-9 shadow-md shadow-primary/25">
            <Plus className="mr-2 h-3.5 w-3.5" />
            New Template
          </Button>
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
              <Button className="mt-5 shadow-md shadow-primary/20" onClick={() => setShowBlastDialog(true)}>
                <Send className="mr-2 h-4 w-4" />Send Agent Blast
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border/70 overflow-hidden shadow-sm">
              <div className="data-table-header px-5 py-3 grid grid-cols-[1fr_auto_auto]">
                <span>Subject</span>
                <span>Recipients</span>
                <span className="text-right">Sent</span>
              </div>
              {[...campaigns].reverse().map((campaign, i) => (
                <div
                  key={campaign.id}
                  className={cn('grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3.5 data-table-row', i === campaigns.length - 1 && 'border-b-0')}
                >
                  <div>
                    <p className="text-sm font-semibold">{campaign.subject}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {campaign.agentGeoFilter.length > 0 ? campaign.agentGeoFilter.join(', ') : 'All regions'}
                      {campaign.preferredOnly ? ' · preferred only' : ''}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold bg-primary/8 text-primary border border-primary/20">
                    {campaign.recipientCount} agents
                  </span>
                  <span className="text-xs text-muted-foreground text-right">
                    {new Date(campaign.sentAt).toLocaleDateString('en-NZ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Template Dialog */}
      <Dialog open={showAddTemplate} onOpenChange={setShowAddTemplate}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplateId ? 'Edit Template' : 'New Email Template'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTemplate} className="space-y-4">
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
              <Label htmlFor="tplSubject">Subject *</Label>
              <Input id="tplSubject" value={templateForm.subject} onChange={(e) => setTemplateForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Welcome to Martelli Buyers, {{clientName}}!" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tplBody">Body</Label>
              <Textarea id="tplBody" value={templateForm.body} onChange={(e) => setTemplateForm((f) => ({ ...f, body: e.target.value }))} rows={10} placeholder="Email body. Use {{variableName}} for dynamic content." />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tplVars">Variables (comma-separated)</Label>
              <Input id="tplVars" value={templateForm.variables} onChange={(e) => setTemplateForm((f) => ({ ...f, variables: e.target.value }))} placeholder="clientName, consultantName, budget" />
              <p className="text-xs text-muted-foreground">List variable names used in subject/body (without curly braces)</p>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={!templateForm.name.trim() || !templateForm.subject.trim()} className="shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />{editTemplateId ? 'Save Changes' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Agent Blast Dialog */}
      <Dialog open={showBlastDialog} onOpenChange={setShowBlastDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Send Agent Requirement Blast</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendBlast} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="blastDeal">Linked deal (optional)</Label>
              <Select id="blastDeal" value={blastForm.dealId} onChange={(e) => setBlastForm((f) => ({ ...f, dealId: e.target.value }))}>
                <option value="">No deal linked</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.clientName}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="blastTemplate">Template *</Label>
              <Select id="blastTemplate" value={blastForm.templateId} onChange={(e) => setBlastForm((f) => ({ ...f, templateId: e.target.value }))}>
                <option value="">Select a template</option>
                {templates.filter((t) => t.isActive).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Target regions</Label>
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
                <span className="text-xs text-muted-foreground self-center italic">(empty = all regions)</span>
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
            <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
              <p className="text-sm">
                <span className="font-bold text-primary text-lg tabular-nums">{blastAgentCount}</span>
                <span className="text-muted-foreground ml-1.5">agents will receive this email</span>
              </p>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={!blastForm.templateId || blastAgentCount === 0 || blasting} className="shadow-sm shadow-primary/20">
                <Send className="mr-2 h-4 w-4" />
                {blasting ? 'Sending…' : `Send to ${blastAgentCount} Agents`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
                  <pre className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">{previewTemplate.body}</pre>
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