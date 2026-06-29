import { useState, useMemo, useEffect } from 'react';
import { useParams, Navigate, Link, useNavigate } from 'react-router-dom';
import { useLeadsStore } from '@/stores/leadsStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useAuthStore } from '@/stores/authStore';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { useMeetStore } from '@/stores/meetStore';
import { useConfigStore } from '@/stores/configStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { ArrowLeft, Phone, Mail, DollarSign, MapPin, Trophy, Pencil, X, FileSignature, Eye, Copy, Check, Loader2, Video, CalendarClock, ExternalLink, Plus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePermissions } from '@/lib/permissions';
import { DocumentViewer } from '@/components/DocumentViewer';
import { canDownloadDoc } from '@/lib/docAccess';
import { sendLeadAgreement, leadAgreementPdfPreviewPath, downloadLeadAgreementPdf } from '@/lib/documents';
import { LEAD_SOURCE_OPTIONS, STATUS_OPTIONS, STATUS_STYLES } from '@/pages/leads/leadShared';
import { LeadStageManager } from '@/pages/leads/LeadStageManager';
import { WonDialog, type WonFormState } from '@/pages/leads/LeadDialogs';
import { useWonConversion } from '@/pages/leads/useWonConversion';
import { useDetailBreadcrumb } from '@/stores/breadcrumbStore';
import { EntityDocuments } from '@/components/documents/EntityDocuments';
import type { Lead, LeadStatus, Meeting } from '@/types';

interface EditForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  notes: string;
  budget: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
  preferredSuburbs: string;
}

/** Build the edit-form state from the current lead (used on every edit-open so it never goes stale). */
function formFromLead(lead: Lead): EditForm {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    phone: lead.phone,
    source: lead.source,
    notes: lead.notes,
    budget: String(lead.budget ?? ''),
    propertyType: lead.propertyType,
    bedrooms: String(lead.bedrooms ?? 3),
    bathrooms: String(lead.bathrooms ?? 2),
    preferredSuburbs: lead.preferredSuburbs.join(', '),
  };
}

export default function LeadDetailPage() {
  // ── Hooks first (no conditional returns before this point) ───────────────
  const { id = '' } = useParams<{ id: string }>();

  const lead = useLeadsStore((s) => s.leads.find((l) => l.id === id));
  const updateLead = useLeadsStore((s) => s.updateLead);
  const toggleStageChecklistItem = useLeadsStore((s) => s.toggleStageChecklistItem);
  const completeAllStageItems = useLeadsStore((s) => s.completeAllStageItems);
  const clearStageProgress = useLeadsStore((s) => s.clearStageProgress);
  const clients = useClientsStore((s) => s.clients);
  const findClientByEmail = useClientsStore((s) => s.findClientByEmail);
  const stages = useQualificationStagesStore((s) => s.stages);
  const convertToWon = useWonConversion();
  const meetings = useMeetStore((s) => s.meetings);
  const fetchMeetings = useMeetStore((s) => s.fetch);
  const hasMeet = useConfigStore((s) => s.hasMeet);
  const { can } = usePermissions();

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  const [showWonDialog, setShowWonDialog] = useState(false);
  const [wonForm, setWonForm] = useState<WonFormState>({ clientMode: 'new', existingClientId: '' });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [meetOpen, setMeetOpen] = useState(false);

  useDetailBreadcrumb(lead ? `${lead.firstName} ${lead.lastName}`.trim() : null);

  // Load meetings once Meet is configured so the header strip can show this
  // lead's scheduled calls. Done lazily here (not at bootstrap) so a slow
  // external service never blocks the page.
  const canViewMeet = can('meet:view');
  useEffect(() => {
    if (hasMeet && canViewMeet) fetchMeetings().catch(() => {});
  }, [hasMeet, canViewMeet, fetchMeetings]);

  // ── Guards (after all hooks) ─────────────────────────────────────────────
  if (!id) return <Navigate to="/leads" replace />;
  if (!lead) return <Navigate to="/leads" replace />;

  const linkedClient = lead.clientId ? clients.find((c) => c.id === lead.clientId) : null;
  const stageProgress = lead.stageProgress ?? {};
  const statusStyle = STATUS_STYLES[lead.status];

  // This lead's meetings = any meeting the buyer is a participant of (they're
  // pre-added when a call is booked from here). Surface upcoming/live ones.
  // RILO may return participants as plain emails OR objects, so extract defensively.
  const leadEmail = lead.email.trim().toLowerCase();
  const leadMeetings = leadEmail
    ? meetings.filter((m) => (m.participants ?? []).some((p) => participantEmail(p) === leadEmail))
    : [];
  const upcomingMeetings = leadMeetings
    .filter((m) => m.status === 'scheduled' || m.status === 'live')
    .sort((a, b) => (a.scheduledStartAt ?? '').localeCompare(b.scheduledStartAt ?? ''));
  const canCreateMeet = can('meet:create');

  // ── Handlers ─────────────────────────────────────────────────────────────
  const startEditing = () => {
    setForm(formFromLead(lead)); // always re-sync from the live lead → never reverts other fields
    setSubmitAttempted(false);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setForm(null);
    setSubmitAttempted(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    setSubmitAttempted(true);
    const invalid: Record<string, boolean> = {
      fn: !form.firstName.trim(),
      ln: !form.lastName.trim(),
      em: !form.email.trim(),
    };
    const firstInvalid = Object.keys(invalid).find((k) => invalid[k]);
    if (firstInvalid) {
      toast.error('First name, last name and email are required.');
      document.getElementById(firstInvalid)?.focus();
      return;
    }
    setSaving(true);
    try {
      await Promise.resolve(updateLead(id, {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        source: form.source,
        notes: form.notes.trim(),
        budget: Number(form.budget) || 0,
        propertyType: form.propertyType.trim(),
        bedrooms: Number(form.bedrooms) || 3,
        bathrooms: Number(form.bathrooms) || 2,
        preferredSuburbs: form.preferredSuburbs.split(',').map((s) => s.trim()).filter(Boolean),
      }));
      setEditing(false);
      setForm(null);
      toast.success('Lead updated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update lead.');
    } finally {
      setSaving(false);
    }
  };

  const openWonDialog = () => {
    const existing = findClientByEmail(lead.email);
    setWonForm({ clientMode: existing ? 'existing' : 'new', existingClientId: existing ? existing.id : '' });
    setShowWonDialog(true);
  };

  const handleConfirmWon = async () => {
    try {
      const { clientCreated } = await convertToWon(lead, wonForm);
      setShowWonDialog(false);
      toast.success(
        clientCreated
          ? 'Lead won — new client and deal created.'
          : 'Lead won — deal created and linked to existing client.',
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to convert lead.');
    }
  };

  const handleStatusChange = (status: LeadStatus) => {
    if (status === 'won') openWonDialog();
    else updateLead(id, { status });
  };

  const f = form ?? formFromLead(lead);
  const fieldError = (val: string) => editing && submitAttempted && !val.trim();

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2 h-8 gap-1.5 text-xs text-muted-foreground">
          <Link to="/leads"><ArrowLeft className="h-3.5 w-3.5" /> Back to leads</Link>
        </Button>
        <div className="rounded-2xl border border-border/70 bg-gradient-to-br from-card to-muted/20 p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary text-lg font-bold shrink-0">
                {lead.firstName?.[0]}{lead.lastName?.[0]}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{lead.firstName} {lead.lastName}</h1>
                  <span className={cn('inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize', statusStyle.pill)}>
                    <span className={cn('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
                    {lead.status.replace('_', ' ')}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">Lead · {lead.source || 'Direct enquiry'}</p>
                <div className="mt-3 flex items-center gap-x-4 gap-y-1.5 flex-wrap text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{lead.email}</span>
                  </span>
                  {lead.phone && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 shrink-0" />{lead.phone}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-medium text-foreground tabular-nums">${lead.budget.toLocaleString()}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-2.5 shrink-0 sm:w-48">
              {hasMeet && canCreateMeet && (
                <Button size="sm" onClick={() => setMeetOpen(true)} className="shadow-sm shadow-primary/20">
                  <Video className="mr-1.5 h-3.5 w-3.5" /> New meeting
                </Button>
              )}
              <div className="space-y-1">
                <Label htmlFor="lead-status" className="text-[11px] uppercase tracking-wide text-muted-foreground">Pipeline status</Label>
                <Select id="lead-status" value={lead.status} onChange={(e) => handleStatusChange(e.target.value as LeadStatus)} className="text-sm">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </Select>
              </div>
              {lead.status !== 'won' && lead.status !== 'lost' && (
                <Button size="sm" variant="outline" onClick={openWonDialog}>
                  <Trophy className="mr-1.5 h-3.5 w-3.5" /> Mark as Won
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scheduled meetings strip — the buyer's upcoming RILO Meet calls */}
      {hasMeet && (upcomingMeetings.length > 0 || canCreateMeet) && (
        <LeadMeetingsStrip
          meetings={upcomingMeetings}
          canCreate={canCreateMeet}
          onNew={() => setMeetOpen(true)}
        />
      )}

      {/* Linked client banner */}
      {linkedClient && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-primary/30 bg-primary/5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary text-xs font-bold shrink-0">
            {linkedClient.firstName[0]}{linkedClient.lastName[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{linkedClient.firstName} {linkedClient.lastName}</p>
            <p className="text-xs text-muted-foreground">Linked client profile</p>
          </div>
          <Button asChild variant="outline" size="sm" className="h-8 text-xs shrink-0">
            <Link to={`/clients/${linkedClient.id}`}>View Client</Link>
          </Button>
        </div>
      )}

      {/* Qualification stage manager (track + checklist + advance) */}
      <LeadStageManager
        currentStageId={lead.qualificationStageId}
        stageProgress={stageProgress}
        sortedStages={sortedStages}
        onChangeStage={(stageId) => updateLead(id, { qualificationStageId: stageId })}
        onToggle={(stageId, itemId) => toggleStageChecklistItem(id, stageId, itemId)}
        onCompleteAll={(stageId, itemIds) => completeAllStageItems(id, stageId, itemIds)}
        onClearAll={(stageId) => clearStageProgress(id, stageId)}
      />

      {/* Details — single edit bar drives all three cards via one form */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Lead Details</h2>
        {editing ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={saving}>
              <X className="mr-1.5 h-3.5 w-3.5" /> Cancel
            </Button>
            <Button size="sm" type="submit" form="lead-edit-form" loading={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={startEditing}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit details
          </Button>
        )}
      </div>

      <form id="lead-edit-form" onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Contact Details</CardTitle>
          </CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fn">First name *</Label>
                    <Input id="fn" value={f.firstName} aria-invalid={fieldError(f.firstName)} onChange={(e) => setForm({ ...f, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ln">Last name *</Label>
                    <Input id="ln" value={f.lastName} aria-invalid={fieldError(f.lastName)} onChange={(e) => setForm({ ...f, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em">Email *</Label>
                  <Input id="em" type="email" value={f.email} aria-invalid={fieldError(f.email)} onChange={(e) => setForm({ ...f, email: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ph">Phone</Label>
                  <Input id="ph" value={f.phone} onChange={(e) => setForm({ ...f, phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="src">Lead source</Label>
                  <Select id="src" value={f.source} onChange={(e) => setForm({ ...f, source: e.target.value })} className="h-10 w-full">
                    <option value="">Select a source...</option>
                    {LEAD_SOURCE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />{lead.email}
                </div>
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />{lead.phone}
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />Budget: ${lead.budget.toLocaleString()}
                </div>
                {lead.preferredSuburbs.length > 0 && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />{lead.preferredSuburbs.join(', ')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Property Requirements</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="budget">Budget ($)</Label>
                  <Input id="budget" type="number" min="0" value={f.budget} onChange={(e) => setForm({ ...f, budget: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pt">Property type</Label>
                  <Input id="pt" value={f.propertyType} onChange={(e) => setForm({ ...f, propertyType: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="beds">Beds</Label>
                    <Input id="beds" type="number" min="0" value={f.bedrooms} onChange={(e) => setForm({ ...f, bedrooms: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="baths">Baths</Label>
                    <Input id="baths" type="number" min="0" value={f.bathrooms} onChange={(e) => setForm({ ...f, bathrooms: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="subs">Preferred suburbs</Label>
                  <Input id="subs" value={f.preferredSuburbs} onChange={(e) => setForm({ ...f, preferredSuburbs: e.target.value })} placeholder="Comma-separated" />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Budget</p>
                    <p className="font-semibold">${lead.budget.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Type</p>
                    <p className="font-semibold">{lead.propertyType || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Bedrooms</p>
                    <p className="font-semibold">{lead.bedrooms}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Bathrooms</p>
                    <p className="font-semibold">{lead.bathrooms}</p>
                  </div>
                </div>
                {lead.preferredSuburbs.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5">Preferred Suburbs</p>
                    <div className="flex gap-1.5 flex-wrap">
                      {lead.preferredSuburbs.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Qualification Notes</CardTitle></CardHeader>
          <CardContent>
            {editing ? (
              <Textarea value={f.notes} onChange={(e) => setForm({ ...f, notes: e.target.value })} rows={4} placeholder="Notes from qualification call..." />
            ) : (
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{lead.notes || 'No notes recorded.'}</p>
            )}
          </CardContent>
        </Card>
      </form>

      {/* Agency agreement */}
      <LeadAgreementCard lead={lead} />

      {/* Documents */}
      <EntityDocuments entityType="lead" entityId={lead.id} />

      {/* Mark as Won dialog (shared with the Leads list) */}
      <WonDialog
        lead={showWonDialog ? lead : null}
        clients={clients}
        form={wonForm}
        onFormChange={setWonForm}
        onOpenChange={setShowWonDialog}
        onConfirm={handleConfirmWon}
      />

      {/* Schedule / start a meeting with this buyer (RILO Meet) */}
      <MeetCreateSheet lead={lead} open={meetOpen} onOpenChange={setMeetOpen} onCreated={() => fetchMeetings().catch(() => {})} />
    </div>
  );
}

/* ─── Agency agreement (authored + e-signed during the lead phase) ─── */
function LeadAgreementCard({ lead }: { lead: Lead }) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { can } = usePermissions();
  const [sending, setSending] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [copied, setCopied] = useState(false);

  const canEdit = can('leads:edit');
  const status = lead.agreementStatus;
  const signUrl = lead.agreementSignToken ? `${window.location.origin}/sign/${lead.agreementSignToken}` : '';

  const handleSend = async () => {
    setSending(true);
    try {
      const { emailed } = await sendLeadAgreement(lead.id);
      await useLeadsStore.getState().fetch();
      toast.success(emailed
        ? 'Agreement emailed to the buyer for signing.'
        : 'Agreement ready — email is not configured, share the signing link manually.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send agreement.');
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(signUrl).then(
      () => { setCopied(true); setTimeout(() => setCopied(false), 2000); },
      () => toast.error('Could not copy link.'),
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-4 w-4 text-primary" /> Agency Agreement
          <Badge variant={status === 'signed' ? 'default' : status === 'sent' ? 'secondary' : 'outline'}>
            {status === 'signed' ? 'Signed' : status === 'sent' ? 'Sent' : 'Pending'}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && status !== 'signed' && (
            <Button size="sm" onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileSignature className="mr-1.5 h-3.5 w-3.5" />}
              {sending ? 'Sending…' : status === 'sent' ? 'Resend' : 'Generate & Send'}
            </Button>
          )}
          {canEdit && status !== 'signed' && (
            <Button size="sm" variant="outline" onClick={() => navigate(`/leads/${lead.id}/agreement`)}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit agreement
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setViewing(true)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> {status === 'signed' ? 'Signed PDF' : 'Preview PDF'}
          </Button>
        </div>

        {status === 'sent' && signUrl && (
          <div className="space-y-2">
            {lead.agreementSentAt && (
              <p className="text-xs text-muted-foreground">
                Sent {new Date(lead.agreementSentAt).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Input readOnly value={signUrl} className="h-8 text-xs" />
              <Button size="sm" variant="outline" className="h-8 shrink-0" onClick={copyLink} title="Copy signing link">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        )}

        {status === 'signed' && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900/30 dark:bg-emerald-900/10">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            <p className="text-xs leading-relaxed text-emerald-800 dark:text-emerald-300">
              Signed by <span className="font-semibold">{lead.agreementSignerName}</span>
              {lead.agreementSignedAt && ` on ${new Date(lead.agreementSignedAt).toLocaleDateString('en-NZ', { year: 'numeric', month: 'long', day: 'numeric' })}`}.
            </p>
          </div>
        )}
      </CardContent>

      {viewing && (
        <DocumentViewer
          open={viewing}
          onClose={() => setViewing(false)}
          title="Agency agreement"
          mimeType="application/pdf"
          previewPath={leadAgreementPdfPreviewPath(lead.id)}
          canDownload={canDownloadDoc(lead.assignedTo, currentUser)}
          onDownload={() => downloadLeadAgreementPdf(lead.id)}
        />
      )}
    </Card>
  );
}

/* ─── Meetings (RILO Meet) ───────────────────────────────────────────────── */

/**
 * Lower-cased email for a participant entry. The Meet API is inconsistent —
 * a participant may be a plain email string or an object ({ email | address }).
 * Anything unrecognised yields '' so matching/`.some` never throws.
 */
function participantEmail(p: unknown): string {
  if (typeof p === 'string') return p.toLowerCase();
  if (p && typeof p === 'object') {
    const o = p as { email?: unknown; address?: unknown };
    const e = typeof o.email === 'string' ? o.email : typeof o.address === 'string' ? o.address : '';
    return e.toLowerCase();
  }
  return '';
}

/** Friendly "Wed 3 Jul, 2:30 pm" for a scheduled start. */
function formatMeetingWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/**
 * The buyer's upcoming meetings, shown directly under the header. Each card
 * opens/joins the RILO room; the leading "New meeting" tile books another.
 */
function LeadMeetingsStrip({ meetings, canCreate, onNew }: { meetings: Meeting[]; canCreate: boolean; onNew: () => void }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-primary" /> Meetings
          {meetings.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground tabular-nums">{meetings.length}</span>
          )}
        </h2>
        {canCreate && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={onNew}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> New meeting
          </Button>
        )}
      </div>

      {meetings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No meetings scheduled with this buyer yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {meetings.map((m) => {
            const when = formatMeetingWhen(m.scheduledStartAt);
            const live = m.status === 'live';
            const participantCount = m.participants?.length ?? 0;
            return (
              <div key={m.meetingId} className="flex flex-col gap-2 rounded-xl border border-border/70 bg-background/40 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold leading-tight line-clamp-1">{m.title || 'Untitled meeting'}</p>
                  <span className={cn(
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                    live ? 'bg-success/15 text-success' : 'bg-info/15 text-info',
                  )}>
                    {live ? 'Live' : 'Scheduled'}
                  </span>
                </div>
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  {when && (
                    <span className="flex items-center gap-1.5">
                      <CalendarClock className="h-3 w-3 shrink-0" />
                      {when}{m.scheduledDurationMinutes ? ` · ${m.scheduledDurationMinutes} min` : ''}
                    </span>
                  )}
                  {participantCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3 w-3 shrink-0" />{participantCount} participant{participantCount === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  className="mt-auto h-8 text-xs"
                  disabled={!m.meetingLinkUrl}
                  onClick={() => m.meetingLinkUrl && window.open(m.meetingLinkUrl, '_blank', 'noopener')}
                >
                  <ExternalLink className="mr-1.5 h-3 w-3" />{live ? 'Join' : 'Open'}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MEET_FORM_DEFAULTS = { scheduled: false, scheduledStartAt: '', scheduledDurationMinutes: '45' };

/** Controlled create/schedule sheet, pre-filled for a given lead. */
function MeetCreateSheet({
  lead, open, onOpenChange, onCreated,
}: { lead: Lead; open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
  const currentUser = useAuthStore((s) => s.currentUser);
  const createMeeting = useMeetStore((s) => s.create);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', hostEmail: '', participants: '', ...MEET_FORM_DEFAULTS });

  // Re-seed the form from the lead each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const name = `${lead.firstName} ${lead.lastName}`.trim() || 'buyer';
    setForm({ title: `Meeting with ${name}`, hostEmail: currentUser?.email ?? '', participants: lead.email, ...MEET_FORM_DEFAULTS });
  }, [open, lead.firstName, lead.lastName, lead.email, currentUser?.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = form.title.trim();
    const hostEmail = form.hostEmail.trim().toLowerCase();
    if (!title) { toast.error('A meeting title is required.'); return; }
    if (!hostEmail) { toast.error('A host email is required.'); return; }

    const participants = form.participants.split(/[\s,;]+/).map((p) => p.trim().toLowerCase()).filter(Boolean);
    const payload: Parameters<typeof createMeeting>[0] = { title, hostEmail, participants };

    if (form.scheduled) {
      if (!form.scheduledStartAt) { toast.error('Pick a start time for the scheduled meeting.'); return; }
      const duration = Number(form.scheduledDurationMinutes);
      if (!Number.isFinite(duration) || duration <= 0) { toast.error('Enter a valid duration in minutes.'); return; }
      payload.scheduledStartAt = new Date(form.scheduledStartAt).toISOString();
      payload.scheduledDurationMinutes = duration;
    }

    setSaving(true);
    try {
      const meeting = await createMeeting(payload);
      onOpenChange(false);
      onCreated();
      if (meeting?.meetingLinkUrl && !form.scheduled) {
        toast.success('Meeting created.', {
          action: { label: 'Join', onClick: () => window.open(meeting.meetingLinkUrl, '_blank', 'noopener') },
        });
      } else {
        toast.success(form.scheduled ? 'Meeting scheduled.' : 'Meeting created.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the meeting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <SheetContent size="lg">
        <SheetHeader><SheetTitle>New Meeting</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="lm-title">Title *</Label>
              <Input id="lm-title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lm-host">Host email *</Label>
              <Input id="lm-host" type="email" value={form.hostEmail} onChange={(e) => setForm((f) => ({ ...f, hostEmail: e.target.value }))} placeholder="you@yourfirm.com" />
              <p className="text-[11px] text-muted-foreground">Must be an existing RILO user.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lm-participants">Participants</Label>
              <Textarea id="lm-participants" rows={2} value={form.participants} onChange={(e) => setForm((f) => ({ ...f, participants: e.target.value }))} placeholder="buyer@example.com" />
              <p className="text-[11px] text-muted-foreground">Comma- or space-separated emails. They wait in the lobby until the host admits them.</p>
            </div>
            <label className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 text-sm cursor-pointer hover:bg-muted transition-colors">
              <input type="checkbox" checked={form.scheduled} onChange={(e) => setForm((f) => ({ ...f, scheduled: e.target.checked }))} className="rounded" />
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Schedule for later</span>
            </label>
            {form.scheduled && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="lm-start">Start time *</Label>
                  <Input id="lm-start" type="datetime-local" value={form.scheduledStartAt} onChange={(e) => setForm((f) => ({ ...f, scheduledStartAt: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lm-duration">Duration (min) *</Label>
                  <Input id="lm-duration" type="number" min={1} value={form.scheduledDurationMinutes} onChange={(e) => setForm((f) => ({ ...f, scheduledDurationMinutes: e.target.value }))} />
                </div>
              </div>
            )}
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild><Button type="button" variant="ghost" disabled={saving}>Cancel</Button></SheetClose>
            <Button type="submit" disabled={saving || !form.title.trim() || !form.hostEmail.trim()} className="shadow-sm shadow-primary/20">
              {saving
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</>
                : <><Video className="mr-2 h-4 w-4" />{form.scheduled ? 'Schedule Meeting' : 'Start Meeting'}</>}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
