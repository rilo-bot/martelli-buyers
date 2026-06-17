import { useMemo, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Plus, Paperclip, Trash2, FileText, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useOffersStore } from '@/stores/offersStore';
import { uploadFile } from '@/lib/upload';
import type { Offer, OfferStatus, Property } from '@/types';

const STATUS_OPTIONS: OfferStatus[] = ['draft', 'submitted', 'negotiating', 'accepted', 'declined', 'withdrawn'];

const STATUS_LABELS: Record<OfferStatus, string> = {
  draft: 'Draft', submitted: 'Submitted', negotiating: 'Negotiating',
  accepted: 'Accepted', declined: 'Declined', withdrawn: 'Withdrawn',
};

const STATUS_BADGE: Record<OfferStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  submitted: 'bg-primary/10 text-primary border-primary/20',
  negotiating: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40',
  accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
  declined: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/40',
  withdrawn: 'bg-muted text-muted-foreground border-border',
};

const money = (n: number) => `$${(n || 0).toLocaleString()}`;

interface OfferForm {
  propertyId: string;
  amount: string;
  depositAmount: string;
  dateSubmitted: string;
  conditions: string;
  status: OfferStatus;
  counterOffer: string;
  outcome: string;
  notes: string;
  fileUrls: string[];
}

const emptyForm = (propertyId = ''): OfferForm => ({
  propertyId, amount: '', depositAmount: '', dateSubmitted: '', conditions: '',
  status: 'draft', counterOffer: '', outcome: '', notes: '', fileUrls: [],
});

export function OffersTab({ dealId, properties }: { dealId: string; properties: Property[] }) {
  const offers = useOffersStore((s) => s.offers);
  const addOffer = useOffersStore((s) => s.addOffer);
  const updateOffer = useOffersStore((s) => s.updateOffer);
  const deleteOffer = useOffersStore((s) => s.deleteOffer);

  const dealOffers = useMemo(() => offers.filter((o) => o.dealId === dealId), [offers, dealId]);
  const propertyLabel = (id: string) => {
    const p = properties.find((pr) => pr.id === id);
    return p ? p.address || p.suburb || 'Property' : 'No property linked';
  };

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(properties[0]?.id ?? ''));
    setDialogOpen(true);
  };

  const openEdit = (o: Offer) => {
    setEditingId(o.id);
    setForm({
      propertyId: o.propertyId, amount: String(o.amount || ''), depositAmount: String(o.depositAmount || ''),
      dateSubmitted: o.dateSubmitted, conditions: o.conditions, status: o.status,
      counterOffer: String(o.counterOffer || ''), outcome: o.outcome, notes: o.notes, fileUrls: o.fileUrls ?? [],
    });
    setDialogOpen(true);
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files)) {
        urls.push(await uploadFile(file, { scope: 'offers', scopeId: dealId }));
      }
      setForm((f) => ({ ...f, fileUrls: [...f.fileUrls, ...urls] }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = {
      dealId,
      propertyId: form.propertyId,
      amount: Number(form.amount) || 0,
      depositAmount: Number(form.depositAmount) || 0,
      dateSubmitted: form.dateSubmitted,
      conditions: form.conditions.trim(),
      status: form.status,
      counterOffer: Number(form.counterOffer) || 0,
      outcome: form.outcome.trim(),
      notes: form.notes.trim(),
      fileUrls: form.fileUrls,
    };
    try {
      if (editingId) await updateOffer(editingId, payload);
      else await addOffer(payload);
      toast.success(editingId ? 'Offer updated.' : 'Offer added.');
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save offer.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteOffer(id);
      toast.success('Offer deleted.');
      setConfirmDeleteId(null);
    } catch {
      toast.error('Failed to delete offer.');
    } finally {
      setDeleting(false);
    }
  };

  // Inline status change without opening the dialog.
  const changeStatus = async (o: Offer, status: OfferStatus) => {
    try {
      await updateOffer(o.id, { status });
    } catch {
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{dealOffers.length} offer{dealOffers.length === 1 ? '' : 's'} on this journey</p>
        <Button size="sm" onClick={openCreate}><Plus className="mr-1.5 h-3.5 w-3.5" />New Offer</Button>
      </div>

      {dealOffers.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              compact
              icon={FileText}
              title="No offers yet"
              description="Record an offer placed on a property in this journey."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {dealOffers.map((o) => (
            <Card key={o.id} className="border-border/70">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-bold tabular-nums">{money(o.amount)}</span>
                      <Select
                        value={o.status}
                        onChange={(e) => changeStatus(o, e.target.value as OfferStatus)}
                        className={cn('h-7 text-xs font-semibold border w-36', STATUS_BADGE[o.status])}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s} className="bg-background text-foreground font-normal">{STATUS_LABELS[s]}</option>
                        ))}
                      </Select>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{propertyLabel(o.propertyId)}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                      {o.depositAmount > 0 && <span>Deposit {money(o.depositAmount)}</span>}
                      {o.counterOffer > 0 && <span>Counter {money(o.counterOffer)}</span>}
                      {o.dateSubmitted && <span>Submitted {o.dateSubmitted}</span>}
                    </div>
                    {o.conditions && <p className="text-xs mt-2"><span className="font-semibold">Conditions:</span> {o.conditions}</p>}
                    {o.outcome && <p className="text-xs mt-1"><span className="font-semibold">Outcome:</span> {o.outcome}</p>}
                    {o.fileUrls?.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {o.fileUrls.map((u, i) => (
                          <a key={u} href={u} target="_blank" rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <Paperclip className="h-3 w-3" />File {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(o)}>Edit</Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => setConfirmDeleteId(o.id)} aria-label="Delete offer">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent size="lg">
          <SheetHeader><SheetTitle>{editingId ? 'Edit Offer' : 'New Offer'}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="of-prop">Property</Label>
              <Select id="of-prop" value={form.propertyId} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))} className="h-10 w-full">
                <option value="">No property linked</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.address || p.suburb || 'Property'}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="of-amt">Offer amount ($)</Label>
                <Input id="of-amt" type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="of-dep">Deposit ($)</Label>
                <Input id="of-dep" type="number" value={form.depositAmount} onChange={(e) => setForm((f) => ({ ...f, depositAmount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="of-date">Date submitted</Label>
                <Input id="of-date" type="date" value={form.dateSubmitted} onChange={(e) => setForm((f) => ({ ...f, dateSubmitted: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="of-status">Status</Label>
                <Select id="of-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as OfferStatus }))} className="h-10 w-full">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-cond">Conditions</Label>
              <Textarea id="of-cond" rows={2} value={form.conditions} onChange={(e) => setForm((f) => ({ ...f, conditions: e.target.value }))}
                placeholder="Finance, LIM, builder's report, settlement date…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="of-counter">Counter offer ($)</Label>
                <Input id="of-counter" type="number" value={form.counterOffer} onChange={(e) => setForm((f) => ({ ...f, counterOffer: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="of-outcome">Outcome</Label>
                <Input id="of-outcome" value={form.outcome} onChange={(e) => setForm((f) => ({ ...f, outcome: e.target.value }))} placeholder="e.g. Accepted at $X" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="of-notes">Notes</Label>
              <Textarea id="of-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Attachments</Label>
              <input ref={fileInput} type="file" accept="image/*,video/*" multiple className="hidden"
                onChange={(e) => handleUpload(e.target.files)} />
              <div className="flex flex-wrap items-center gap-2">
                {form.fileUrls.map((u, i) => (
                  <span key={u} className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs">
                    <Paperclip className="h-3 w-3" />File {i + 1}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, fileUrls: f.fileUrls.filter((x) => x !== u) }))}
                      className="text-muted-foreground hover:text-destructive"><X className="h-3 w-3" /></button>
                  </span>
                ))}
                <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                  {uploading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Uploading…</> : <><Paperclip className="mr-1.5 h-3.5 w-3.5" />Attach</>}
                </Button>
              </div>
            </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : editingId ? 'Save Changes' : 'Add Offer'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o && !deleting) setConfirmDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete offer?</DialogTitle>
            <DialogDescription>
              This permanently removes the offer, including its amount, conditions and attachments. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" disabled={deleting}>Cancel</Button></DialogClose>
            <Button variant="destructive" loading={deleting} onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
              {deleting ? 'Deleting…' : 'Delete offer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
