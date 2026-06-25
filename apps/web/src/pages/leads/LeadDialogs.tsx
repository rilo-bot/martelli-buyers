import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Plus, Trophy, Users, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LEAD_SOURCE_OPTIONS, PROPERTY_TYPE_OPTIONS } from './leadShared';
import type { Lead, Client, QualificationStage } from '@/types';

export type NewLeadInput = Omit<
  Lead,
  'id' | 'createdAt' | 'updatedAt' | 'stageProgress'
  // Agreement fields are server-defaulted (authored later on the lead), not set at creation.
  | 'agreementStatus' | 'agreementUrl' | 'agreementSignToken' | 'agreementSentAt'
  | 'agreementSignerName' | 'agreementSignedAt' | 'agreementSignerIp'
  | 'agreementSignatureImage' | 'agreementBodyHtml'
>;

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '', source: '', notes: '',
  budget: '', propertyTypeSelect: '', propertyTypeOther: '',
  bedrooms: '3', bathrooms: '2', preferredSuburbs: '', qualificationStageId: '',
};

const popularOptions = PROPERTY_TYPE_OPTIONS.filter((o) => o.group === 'popular');
const standardOptions = PROPERTY_TYPE_OPTIONS.filter((o) => o.group === 'standard');

/* ─── Add Lead ──────────────────────────────────────────────────────────── */

export function AddLeadDialog({
  open,
  onOpenChange,
  sortedStages,
  defaultAssignedTo,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  sortedStages: QualificationStage[];
  defaultAssignedTo: string;
  onSubmit: (lead: NewLeadInput) => void | Promise<void>;
}) {
  const [form, setForm] = useState(EMPTY_FORM);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error('First name, last name and email are required.');
      return;
    }
    const propertyType = form.propertyTypeSelect === 'Other' ? form.propertyTypeOther.trim() : form.propertyTypeSelect;
    await onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      source: form.source,
      status: 'new',
      qualificationStageId: form.qualificationStageId,
      notes: form.notes.trim(),
      budget: Number(form.budget) || 0,
      propertyType,
      bedrooms: Number(form.bedrooms) || 3,
      bathrooms: Number(form.bathrooms) || 2,
      preferredSuburbs: form.preferredSuburbs.split(',').map((s) => s.trim()).filter(Boolean),
      assignedTo: defaultAssignedTo,
      clientId: '',
    });
    setForm(EMPTY_FORM);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent size="lg">
        <SheetHeader><SheetTitle>Add New Lead</SheetTitle></SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name *</Label>
              <Input id="firstName" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Jane" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name *</Label>
              <Input id="lastName" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Smith" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email *</Label>
            <Input id="email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jane@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+64 21 xxx xxxx" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="source">Lead source</Label>
              <Select id="source" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} className="h-10 w-full">
                <option value="">Select a source...</option>
                {LEAD_SOURCE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </Select>
            </div>
          </div>
          {sortedStages.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="qualStage">Qualification stage</Label>
              <Select id="qualStage" value={form.qualificationStageId} onChange={(e) => setForm((f) => ({ ...f, qualificationStageId: e.target.value }))} className="h-10 w-full">
                <option value="">Not assigned</option>
                {sortedStages.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </div>
          )}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="budget">Budget ($)</Label>
              <Input id="budget" type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} placeholder="800000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bedrooms">Beds</Label>
              <Input id="bedrooms" type="number" min="1" max="10" value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bathrooms">Baths</Label>
              <Input id="bathrooms" type="number" min="1" max="10" value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="propertyTypeSelect">Property type</Label>
            <Select id="propertyTypeSelect" value={form.propertyTypeSelect} onChange={(e) => setForm((f) => ({ ...f, propertyTypeSelect: e.target.value, propertyTypeOther: '' }))} className="h-10 w-full">
              <option value="">Select a property type...</option>
              <optgroup label="— Popular —">
                {popularOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </optgroup>
              <optgroup label="— More options —">
                {standardOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </optgroup>
            </Select>
            {form.propertyTypeSelect === 'Other' && (
              <Input value={form.propertyTypeOther} onChange={(e) => setForm((f) => ({ ...f, propertyTypeOther: e.target.value }))} placeholder="Please describe the property type..." className="mt-2" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="preferredSuburbs">Preferred suburbs (comma-separated)</Label>
            <Input id="preferredSuburbs" value={form.preferredSuburbs} onChange={(e) => setForm((f) => ({ ...f, preferredSuburbs: e.target.value }))} placeholder="Remuera, Newmarket, Parnell" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Qualification notes..." rows={3} />
          </div>
          </SheetBody>
          <SheetFooter>
            <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
            <Button type="submit" disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}>
              <Plus className="mr-2 h-4 w-4" /> Add Lead
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ─── Mark as Won ───────────────────────────────────────────────────────── */

export interface WonFormState {
  clientMode: 'new' | 'existing';
  existingClientId: string;
}

export function WonDialog({
  lead,
  clients,
  form,
  onFormChange,
  onOpenChange,
  onConfirm,
}: {
  lead: Lead | null;
  clients: Client[];
  form: WonFormState;
  onFormChange: (f: WonFormState) => void;
  onOpenChange: (o: boolean) => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={!!lead} onOpenChange={(o) => { if (!submitting) onOpenChange(o); }}>
      <SheetContent size="md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Mark Lead as Won
          </SheetTitle>
        </SheetHeader>
        <SheetBody>
        {lead && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Marking <strong className="text-foreground">{lead.firstName} {lead.lastName}</strong> as Won will create a new deal. Choose whether to link to an existing client or create a new one.
            </p>
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Client record</Label>
              <div className="flex gap-2">
                <button type="button" onClick={() => onFormChange({ ...form, clientMode: 'new' })}
                  className={cn('flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all text-left', form.clientMode === 'new' ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted')}>
                  <div className="flex items-center gap-2"><Plus className="h-4 w-4" /> New client</div>
                  <p className="text-xs mt-1 text-muted-foreground font-normal">Create a new client profile from this lead</p>
                </button>
                <button type="button" onClick={() => onFormChange({ ...form, clientMode: 'existing' })} disabled={clients.length === 0}
                  className={cn('flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all text-left', form.clientMode === 'existing' ? 'border-primary bg-primary/8 text-primary' : 'border-border bg-card text-muted-foreground hover:bg-muted', clients.length === 0 && 'opacity-50 cursor-not-allowed')}>
                  <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Existing client</div>
                  <p className="text-xs mt-1 text-muted-foreground font-normal">Link to a client already in your CRM</p>
                </button>
              </div>
              {form.clientMode === 'new' && (
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-sm">
                  <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{lead.email}</p>
                  {lead.phone && <p className="text-xs text-muted-foreground">{lead.phone}</p>}
                </div>
              )}
              {form.clientMode === 'existing' && clients.length > 0 && (
                <div className="space-y-1.5">
                  <Label htmlFor="existingClient">Select existing client</Label>
                  <Select id="existingClient" value={form.existingClientId} onChange={(e) => onFormChange({ ...form, existingClientId: e.target.value })} className="h-10 w-full">
                    <option value="">Choose a client...</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>)}
                  </Select>
                </div>
              )}
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-semibold text-foreground">What happens next:</p>
              <p>• Lead status → <strong>Won</strong></p>
              <p>• New deal created in <strong>Qualification</strong> stage</p>
              <p>• Deal linked to {form.clientMode === 'new' ? 'a new client profile' : 'the selected client'}</p>
            </div>
          </div>
        )}
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild><Button variant="ghost" disabled={submitting}>Cancel</Button></SheetClose>
          <Button
            onClick={handleConfirm}
            disabled={submitting || (form.clientMode === 'existing' && !form.existingClientId)}
          >
            {submitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Converting…</>
            ) : (
              <><CheckCircle className="mr-2 h-4 w-4" /> Confirm — Mark as Won</>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
