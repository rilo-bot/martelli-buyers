import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Home, Loader2, Trophy, Trash2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePurchasesStore } from '@/stores/purchasesStore';
import { useDealsStore } from '@/stores/dealsStore';
import type { Purchase, PurchaseStatus, Property, DealStage } from '@/types';

const STATUS_OPTIONS: PurchaseStatus[] = ['pending', 'unconditional', 'settled'];
const STATUS_LABEL: Record<PurchaseStatus, string> = { pending: 'Pending', unconditional: 'Unconditional', settled: 'Settled' };
const STATUS_BADGE: Record<PurchaseStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/40',
  unconditional: 'bg-primary/10 text-primary border-primary/20',
  settled: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
};

const money = (n: number) => (n ? `$${n.toLocaleString()}` : '—');

interface PurchaseForm {
  propertyId: string;
  purchasePrice: string;
  depositPaid: string;
  unconditionalDate: string;
  settlementDate: string;
  status: PurchaseStatus;
  solicitor: string;
  notes: string;
}

const formFrom = (p: Purchase | undefined, defaultPropertyId: string): PurchaseForm => ({
  propertyId: p?.propertyId || defaultPropertyId,
  purchasePrice: p ? String(p.purchasePrice || '') : '',
  depositPaid: p ? String(p.depositPaid || '') : '',
  unconditionalDate: p?.unconditionalDate || '',
  settlementDate: p?.settlementDate || '',
  status: p?.status || 'pending',
  solicitor: p?.solicitor || '',
  notes: p?.notes || '',
});

export function PurchaseTab({ dealId, properties, stage }: { dealId: string; properties: Property[]; stage: DealStage }) {
  const purchases = usePurchasesStore((s) => s.purchases);
  const addPurchase = usePurchasesStore((s) => s.addPurchase);
  const updatePurchase = usePurchasesStore((s) => s.updatePurchase);
  const deletePurchase = usePurchasesStore((s) => s.deletePurchase);
  const updateDeal = useDealsStore((s) => s.updateDeal);

  const purchase = purchases.find((p) => p.dealId === dealId);
  const purchasedProperty = purchase ? properties.find((p) => p.id === purchase.propertyId) : undefined;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<PurchaseForm>(formFrom(undefined, ''));
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openDialog = () => {
    setForm(formFrom(purchase, properties.find((p) => p.status === 'offer_placed')?.id || properties[0]?.id || ''));
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const payload = {
      dealId,
      propertyId: form.propertyId,
      purchasePrice: Number(form.purchasePrice) || 0,
      depositPaid: Number(form.depositPaid) || 0,
      unconditionalDate: form.unconditionalDate,
      settlementDate: form.settlementDate,
      status: form.status,
      solicitor: form.solicitor.trim(),
      notes: form.notes.trim(),
    };
    try {
      if (purchase) await updatePurchase(purchase.id, payload);
      else await addPurchase(payload);
      toast.success(purchase ? 'Purchase updated.' : 'Purchase recorded.');
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save purchase.');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (status: PurchaseStatus) => {
    if (!purchase) return;
    try {
      await updatePurchase(purchase.id, { status });
    } catch {
      toast.error('Failed to update status.');
    }
  };

  const handleDelete = async () => {
    if (!purchase || deleting) return;
    setDeleting(true);
    try {
      await deletePurchase(purchase.id);
      toast.success('Purchase removed.');
      setConfirmDelete(false);
    } catch {
      toast.error('Failed to remove purchase.');
    } finally {
      setDeleting(false);
    }
  };

  const markComplete = async () => {
    try {
      await updateDeal(dealId, { stage: 'complete' });
      toast.success('Journey marked complete.');
    } catch {
      toast.error('Failed to update journey.');
    }
  };

  return (
    <div className="space-y-4">
      {!purchase ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              compact
              icon={Trophy}
              title="No purchase recorded"
              description="Record the final purchase that closes this buyer journey."
              action={<Button size="sm" onClick={openDialog}><Trophy className="mr-1.5 h-3.5 w-3.5" />Record Purchase</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/70">
          <CardHeader className="pb-3 flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500" />
              Purchase
              <span className={cn('text-xs px-2 py-0.5 rounded-full border font-semibold', STATUS_BADGE[purchase.status])}>
                {STATUS_LABEL[purchase.status]}
              </span>
            </CardTitle>
            <div className="flex items-center gap-1">
              <Select value={purchase.status} onChange={(e) => changeStatus(e.target.value as PurchaseStatus)} className="h-8 text-xs w-36">
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </Select>
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={openDialog}>Edit</Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)} aria-label="Remove purchase">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{purchasedProperty?.address || 'Property'}</span>
              {purchasedProperty?.suburb && <span className="text-muted-foreground">· {purchasedProperty.suburb}</span>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Purchase price</p>
                <p className="font-semibold tabular-nums">{money(purchase.purchasePrice)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Deposit paid</p>
                <p className="font-semibold tabular-nums">{money(purchase.depositPaid)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Unconditional</p>
                <p className="font-semibold">{purchase.unconditionalDate || '—'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Settlement</p>
                <p className="font-semibold">{purchase.settlementDate || '—'}</p>
              </div>
            </div>
            {purchase.solicitor && <p className="text-sm"><span className="text-muted-foreground">Solicitor:</span> {purchase.solicitor}</p>}
            {purchase.notes && <p className="text-sm text-muted-foreground">{purchase.notes}</p>}

            {stage !== 'complete' && (
              <div className="pt-2 border-t border-border/60">
                <Button size="sm" variant="outline" onClick={markComplete}>
                  <CheckCircle className="mr-1.5 h-3.5 w-3.5" />Mark journey complete
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent size="lg">
          <SheetHeader><SheetTitle>{purchase ? 'Edit Purchase' : 'Record Purchase'}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pu-prop">Purchased property</Label>
              <Select id="pu-prop" value={form.propertyId} onChange={(e) => setForm((f) => ({ ...f, propertyId: e.target.value }))} className="h-10 w-full">
                <option value="">Select property</option>
                {properties.map((p) => <option key={p.id} value={p.id}>{p.address || p.suburb || 'Property'}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pu-price">Purchase price ($)</Label>
                <Input id="pu-price" type="number" value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pu-deposit">Deposit paid ($)</Label>
                <Input id="pu-deposit" type="number" value={form.depositPaid} onChange={(e) => setForm((f) => ({ ...f, depositPaid: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pu-uncond">Unconditional date</Label>
                <Input id="pu-uncond" type="date" value={form.unconditionalDate} onChange={(e) => setForm((f) => ({ ...f, unconditionalDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pu-settle">Settlement date</Label>
                <Input id="pu-settle" type="date" value={form.settlementDate} onChange={(e) => setForm((f) => ({ ...f, settlementDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="pu-status">Status</Label>
                <Select id="pu-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PurchaseStatus }))} className="h-10 w-full">
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pu-sol">Solicitor</Label>
                <Input id="pu-sol" value={form.solicitor} onChange={(e) => setForm((f) => ({ ...f, solicitor: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pu-notes">Notes</Label>
              <Textarea id="pu-notes" rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
              <Button type="submit" disabled={saving}>
                {saving ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</> : purchase ? 'Save Changes' : 'Record Purchase'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={confirmDelete} onOpenChange={(o) => { if (!o && !deleting) setConfirmDelete(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove purchase record?</DialogTitle>
            <DialogDescription>
              This permanently deletes the purchase, including price and settlement details. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" disabled={deleting}>Cancel</Button></DialogClose>
            <Button variant="destructive" loading={deleting} onClick={handleDelete}>
              {deleting ? 'Removing…' : 'Remove purchase'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
