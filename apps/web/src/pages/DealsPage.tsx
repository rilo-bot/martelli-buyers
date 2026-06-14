import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useDealsStore } from '@/stores/dealsStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/lib/permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Plus, Search, FileText, ArrowRight, DollarSign, Home, MapPin, Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { DealStage } from '@/types';

const STAGE_OPTIONS: DealStage[] = ['qualification', 'search', 'shortlisting', 'due_diligence', 'offer', 'settlement', 'complete'];
const STAGE_LABELS: Record<DealStage, string> = {
  qualification: 'Qualification',
  search: 'Search',
  shortlisting: 'Shortlisting',
  due_diligence: 'Due Diligence',
  offer: 'Offer',
  settlement: 'Settlement',
  complete: 'Complete',
};

const STAGE_PILL: Record<DealStage, string> = {
  qualification: 'bg-primary/10 text-primary border-primary/20',
  search: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  shortlisting: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  due_diligence: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  offer: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  settlement: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  complete: 'bg-muted text-muted-foreground border-border',
};

const STAGE_BAR_ACCENT: Record<DealStage, string> = {
  qualification: 'bg-primary',
  search: 'bg-violet-500',
  shortlisting: 'bg-amber-500',
  due_diligence: 'bg-orange-500',
  offer: 'bg-rose-500',
  settlement: 'bg-emerald-500',
  complete: 'bg-muted-foreground',
};

export default function DealsPage() {
  const deals = useDealsStore((s) => s.deals);
  const addDeal = useDealsStore((s) => s.addDeal);
  const clients = useClientsStore((s) => s.clients);
  const addDealToClient = useClientsStore((s) => s.addDealToClient);
  const { can } = usePermissions();
  const canCreate = can('journeys:create');
  const currentUser = useAuthStore((s) => s.currentUser);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);

  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '', brief: '',
    budget: '', fee: '', feeType: 'fixed' as 'fixed' | 'percentage',
    propertyType: '', bedrooms: '3', bathrooms: '2', preferredSuburbs: '', clientId: '',
  });

  const filteredDeals = useMemo(() => {
    const q = search.toLowerCase();
    return deals.filter((d) => {
      const matchesSearch = !q || d.clientName.toLowerCase().includes(q) || d.clientEmail.toLowerCase().includes(q);
      const matchesStage = !stageFilter || d.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [deals, search, stageFilter]);

  const getClientForDeal = (dealId: string) => clients.find((c) => c.dealIds.includes(dealId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.clientName.trim() || !form.clientEmail.trim()) {
      toast.error('Client name and email are required.');
      return;
    }
    const deal = await addDeal({
      leadId: '',
      clientId: form.clientId,
      clientName: form.clientName.trim(),
      clientEmail: form.clientEmail.trim().toLowerCase(),
      clientPhone: form.clientPhone.trim(),
      stage: 'qualification',
      brief: form.brief.trim(),
      budget: Number(form.budget) || 0,
      fee: Number(form.fee) || 0,
      feeType: form.feeType,
      preferredSuburbs: form.preferredSuburbs.split(',').map((s) => s.trim()).filter(Boolean),
      propertyType: form.propertyType.trim(),
      bedrooms: Number(form.bedrooms) || 3,
      bathrooms: Number(form.bathrooms) || 2,
      agreementStatus: 'pending',
      agreementUrl: '',
      agreementSignToken: '', agreementSentAt: '', agreementSignerName: '', agreementSignedAt: '', agreementSignerIp: '',
      invoiceIds: [],
      assignedTo: currentUser?.id ?? '',
      aiConsentStatus: 'pending',
      aiConsentDate: '',
    });
    if (form.clientId) addDealToClient(form.clientId, deal.id);
    setForm({ clientName: '', clientEmail: '', clientPhone: '', brief: '', budget: '', fee: '', feeType: 'fixed', propertyType: '', bedrooms: '3', bathrooms: '2', preferredSuburbs: '', clientId: '' });
    setShowAddDialog(false);
  };

  const handleClientSelect = (clientId: string) => {
    if (!clientId) { setForm((f) => ({ ...f, clientId: '' })); return; }
    const client = clients.find((c) => c.id === clientId);
    if (client) {
      setForm((f) => ({ ...f, clientId, clientName: `${client.firstName} ${client.lastName}`, clientEmail: client.email, clientPhone: client.phone }));
    }
  };

  const maxStageCount = useMemo(() => Math.max(1, ...STAGE_OPTIONS.map((s) => deals.filter((d) => d.stage === s).length)), [deals]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-eyebrow mb-1.5">Engagements</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Buyer Journeys</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage every buyer journey from qualification to settlement.</p>
        </div>
        {canCreate && (
          <Button onClick={() => setShowAddDialog(true)} className="shadow-md shadow-primary/25 h-9">
            <Plus className="mr-2 h-3.5 w-3.5" />
            New Buyer Journey
          </Button>
        )}
      </div>

      {/* Stage pipeline — visual bar */}
      <Card className="border-border/70 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-4 md:grid-cols-7 divide-x divide-border/60">
            {STAGE_OPTIONS.map((stage) => {
              const count = deals.filter((d) => d.stage === stage).length;
              const isActive = stageFilter === stage;
              const barH = maxStageCount > 0 ? Math.max(8, Math.round((count / maxStageCount) * 40)) : 8;
              return (
                <button
                  key={stage}
                  type="button"
                  onClick={() => setStageFilter(stageFilter === stage ? '' : stage)}
                  className={cn(
                    'flex flex-col items-center pt-4 pb-3 px-2 gap-2 text-center transition-all duration-150 relative',
                    isActive ? 'bg-primary/6' : 'bg-card hover:bg-muted/40'
                  )}
                >
                  {isActive && (
                    <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'hsl(var(--primary))' }} />
                  )}
                  {/* Mini bar chart */}
                  <div className="flex items-end h-10 w-full justify-center">
                    <div
                      className={cn('w-4 rounded-t transition-all duration-300', STAGE_BAR_ACCENT[stage])}
                      style={{ height: count > 0 ? `${barH}px` : '4px', opacity: count > 0 ? 1 : 0.25 }}
                    />
                  </div>
                  <span className={cn('text-xl font-bold tabular-nums', isActive ? 'text-primary' : 'text-foreground')}>{count}</span>
                  <span className="text-[9px] text-muted-foreground leading-tight font-semibold uppercase tracking-wide">{STAGE_LABELS[stage]}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search journeys..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="w-44 h-10">
          <option value="">All stages</option>
          {STAGE_OPTIONS.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </Select>
        {stageFilter && (
          <Button variant="ghost" size="sm" className="h-10 text-xs" onClick={() => setStageFilter('')}>Clear filter</Button>
        )}
      </div>

      {/* Campaigns grid */}
      {filteredDeals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-5">
            <FileText className="h-8 w-8 text-primary/40" />
          </div>
          <h3 className="text-lg font-bold">
            {stageFilter ? `No ${STAGE_LABELS[stageFilter as DealStage]} journeys` : 'No buyer journeys yet'}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {stageFilter ? 'Try a different stage filter.' : 'Create your first buyer journey or convert a qualified lead.'}
          </p>
          {!stageFilter && canCreate && (
            <Button className="mt-5 shadow-md shadow-primary/20" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />Create your first buyer journey
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDeals.map((deal) => {
            const linkedClient = getClientForDeal(deal.id);
            const initials = deal.clientName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <Link key={deal.id} to={`/journeys/${deal.id}`}>
                <Card className="group border-border/70 card-interactive h-full bg-card">
                  <CardHeader className="pb-3 px-5 pt-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-10 w-10 items-center justify-center rounded-xl shrink-0 text-[13px] font-bold border"
                          style={{
                            background: 'linear-gradient(135deg, hsl(213 94% 38% / 0.12), hsl(174 72% 38% / 0.08))',
                            borderColor: 'hsl(213 94% 38% / 0.18)',
                            color: 'hsl(213 94% 38%)',
                          }}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <CardTitle className="text-[15px] font-bold group-hover:text-primary transition-colors truncate">
                            {deal.clientName}
                          </CardTitle>
                          <CardDescription className="text-[11px] mt-0.5 truncate">{deal.clientEmail}</CardDescription>
                        </div>
                      </div>
                      <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-bold shrink-0 border', STAGE_PILL[deal.stage])}>
                        {STAGE_LABELS[deal.stage]}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 px-5 pb-5">
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-semibold text-foreground">${deal.budget.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5 shrink-0" />
                        {deal.bedrooms}bd / {deal.bathrooms}ba
                      </div>
                    </div>
                    {deal.preferredSuburbs.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{deal.preferredSuburbs.slice(0, 3).join(', ')}</span>
                      </div>
                    )}
                    {linkedClient && (
                      <div className="flex items-center gap-1.5 text-xs">
                        <Users className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="text-primary font-medium truncate">
                          {linkedClient.firstName} {linkedClient.lastName}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <Badge
                        variant={deal.agreementStatus === 'signed' ? 'default' : 'outline'}
                        className="text-[10px] px-2 py-0.5 font-semibold"
                      >
                        {deal.agreementStatus === 'signed' ? 'Agreement signed' : deal.agreementStatus === 'sent' ? 'Agreement sent' : 'No agreement'}
                      </Badge>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity group-hover:text-primary" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      {/* Add Buyer Journey drawer */}
      <Sheet open={showAddDialog} onOpenChange={setShowAddDialog}>
        <SheetContent size="lg">
          <SheetHeader>
            <SheetTitle>Create New Buyer Journey</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
            {clients.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="clientLink">Link to existing client (optional)</Label>
                <Select id="clientLink" value={form.clientId} onChange={(e) => handleClientSelect(e.target.value)} className="h-10 w-full">
                  <option value="">No existing client — enter details below</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.firstName} {c.lastName} — {c.email}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="clientName">Client name *</Label>
              <Input id="clientName" value={form.clientName} onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))} placeholder="Jane Smith" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="clientEmail">Client email *</Label>
                <Input id="clientEmail" type="email" value={form.clientEmail} onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))} placeholder="client@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="clientPhone">Phone</Label>
                <Input id="clientPhone" value={form.clientPhone} onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))} placeholder="+64 21 xxx xxxx" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget ($)</Label>
                <Input id="budget" type="number" value={form.budget} onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))} placeholder="800000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee">Fee</Label>
                <Input id="fee" type="number" value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} placeholder="15000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feeType">Fee type</Label>
                <Select id="feeType" value={form.feeType} onChange={(e) => setForm((f) => ({ ...f, feeType: e.target.value as 'fixed' | 'percentage' }))}>
                  <option value="fixed">Fixed ($)</option>
                  <option value="percentage">Percentage (%)</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="propertyType">Property type</Label>
                <Input id="propertyType" value={form.propertyType} onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value }))} placeholder="House" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bedrooms">Beds</Label>
                <Input id="bedrooms" type="number" min="1" value={form.bedrooms} onChange={(e) => setForm((f) => ({ ...f, bedrooms: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bathrooms">Baths</Label>
                <Input id="bathrooms" type="number" min="1" value={form.bathrooms} onChange={(e) => setForm((f) => ({ ...f, bathrooms: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferredSuburbs">Preferred suburbs (comma-separated)</Label>
              <Input id="preferredSuburbs" value={form.preferredSuburbs} onChange={(e) => setForm((f) => ({ ...f, preferredSuburbs: e.target.value }))} placeholder="Remuera, Newmarket, Parnell" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="brief">Client brief</Label>
              <Textarea id="brief" value={form.brief} onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))} placeholder="Describe the client's requirements..." rows={3} />
            </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
              <Button type="submit" disabled={!form.clientName.trim() || !form.clientEmail.trim()} className="shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />Create Buyer Journey
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}