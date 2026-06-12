import { useState, useMemo } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useLeadsStore } from '@/stores/leadsStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { getStagePillClass, getStageDotClass } from '@/pages/SettingsPage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { ArrowLeft, Phone, Mail, DollarSign, MapPin, Trophy, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LEAD_SOURCE_OPTIONS, STATUS_OPTIONS, STATUS_STYLES } from '@/pages/leads/leadShared';
import { LeadStageManager } from '@/pages/leads/LeadStageManager';
import { WonDialog, type WonFormState } from '@/pages/leads/LeadDialogs';
import { useWonConversion } from '@/pages/leads/useWonConversion';
import type { Lead, LeadStatus } from '@/types';

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

  const sortedStages = useMemo(() => [...stages].sort((a, b) => a.order - b.order), [stages]);

  const [showWonDialog, setShowWonDialog] = useState(false);
  const [wonForm, setWonForm] = useState<WonFormState>({ clientMode: 'new', existingClientId: '' });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

  // ── Guards (after all hooks) ─────────────────────────────────────────────
  if (!id) return <Navigate to="/leads" replace />;
  if (!lead) return <Navigate to="/leads" replace />;

  const linkedClient = lead.clientId ? clients.find((c) => c.id === lead.clientId) : null;
  const currentStage = sortedStages.find((s) => s.id === lead.qualificationStageId);
  const stageProgress = lead.stageProgress ?? {};
  const statusStyle = STATUS_STYLES[lead.status];

  // ── Handlers ─────────────────────────────────────────────────────────────
  const startEditing = () => {
    setForm(formFromLead(lead)); // always re-sync from the live lead → never reverts other fields
    setEditing(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error('First name, last name and email are required.');
      return;
    }
    updateLead(id, {
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
    });
    setEditing(false);
    toast.success('Lead updated.');
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4 flex-wrap">
        <Button asChild variant="ghost" size="icon" className="-ml-2 mt-1">
          <Link to="/leads"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary text-base font-bold shrink-0">
          {lead.firstName?.[0]}{lead.lastName?.[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold tracking-tight truncate">{lead.firstName} {lead.lastName}</h1>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-sm text-muted-foreground">
            <span>Lead · {lead.source || 'Direct enquiry'}</span>
            <span className={cn('inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-semibold capitalize', statusStyle.pill)}>
              <span className={cn('h-1.5 w-1.5 rounded-full', statusStyle.dot)} />
              {lead.status.replace('_', ' ')}
            </span>
            {currentStage && (
              <span className={cn('inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-semibold', getStagePillClass(currentStage.color))}>
                <span className={cn('h-1.5 w-1.5 rounded-full', getStageDotClass(currentStage.color))} />
                {currentStage.label}
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Select value={lead.status} onChange={(e) => handleStatusChange(e.target.value as LeadStatus)} className="w-36 text-sm">
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </Select>
          {lead.status !== 'won' && lead.status !== 'lost' && (
            <Button size="sm" onClick={openWonDialog} className="shadow-sm shadow-primary/20">
              <Trophy className="mr-1.5 h-3.5 w-3.5" /> Mark as Won
            </Button>
          )}
        </div>
      </div>

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

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Contact Details</CardTitle>
              <Button size="sm" variant="ghost" onClick={() => (editing ? setEditing(false) : startEditing())}>
                {editing ? 'Cancel' : <><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {editing ? (
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fn">First name</Label>
                    <Input id="fn" value={f.firstName} onChange={(e) => setForm({ ...f, firstName: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="ln">Last name</Label>
                    <Input id="ln" value={f.lastName} onChange={(e) => setForm({ ...f, lastName: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="em">Email</Label>
                  <Input id="em" type="email" value={f.email} onChange={(e) => setForm({ ...f, email: e.target.value })} />
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
                <Button type="submit" size="sm">Save Changes</Button>
              </form>
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
                  <Input id="budget" type="number" value={f.budget} onChange={(e) => setForm({ ...f, budget: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pt">Property type</Label>
                  <Input id="pt" value={f.propertyType} onChange={(e) => setForm({ ...f, propertyType: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="beds">Beds</Label>
                    <Input id="beds" type="number" value={f.bedrooms} onChange={(e) => setForm({ ...f, bedrooms: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="baths">Baths</Label>
                    <Input id="baths" type="number" value={f.bathrooms} onChange={(e) => setForm({ ...f, bathrooms: e.target.value })} />
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
      </div>

      {/* Mark as Won dialog (shared with the Leads list) */}
      <WonDialog
        lead={showWonDialog ? lead : null}
        clients={clients}
        form={wonForm}
        onFormChange={setWonForm}
        onOpenChange={setShowWonDialog}
        onConfirm={handleConfirmWon}
      />
    </div>
  );
}
