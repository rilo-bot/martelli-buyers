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
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Plus, Search, FileText, DollarSign, Home, MapPin, Users, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { DealStage } from '@/types';
import {
  DEAL_STAGE_ORDER as STAGE_OPTIONS,
  STAGE_LABELS,
  STAGE_PILL,
  STAGE_BAR_ACCENT,
} from '@/lib/statusStyles';
import { PROPERTY_TYPE_OPTIONS } from './leads/leadShared';

const popularPropertyTypes = PROPERTY_TYPE_OPTIONS.filter((o) => o.group === 'popular');
const standardPropertyTypes = PROPERTY_TYPE_OPTIONS.filter((o) => o.group === 'standard');

export default function DealsPage() {
  const deals = useDealsStore((s) => s.deals);
  const dealsLoaded = useDealsStore((s) => s.loaded);
  const addDeal = useDealsStore((s) => s.addDeal);
  const clients = useClientsStore((s) => s.clients);
  const addDealToClient = useClientsStore((s) => s.addDealToClient);
  const { can } = usePermissions();
  const canCreate = can('journeys:create');
  const currentUser = useAuthStore((s) => s.currentUser);

  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '', brief: '',
    budget: '', fee: '', feeType: 'fixed' as 'fixed' | 'percentage',
    propertyType: '', propertyTypeOther: '', bedrooms: '3', bathrooms: '2', preferredSuburbs: '', clientId: '',
  });

  const debouncedSearch = useDebouncedValue(search, 200);
  const filteredDeals = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return deals.filter((d) => {
      const matchesSearch = !q || d.clientName.toLowerCase().includes(q) || d.clientEmail.toLowerCase().includes(q);
      const matchesStage = !stageFilter || d.stage === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [deals, debouncedSearch, stageFilter]);

  const getClientForDeal = (dealId: string) => clients.find((c) => c.dealIds.includes(dealId));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.clientName.trim() || !form.clientEmail.trim()) {
      toast.error('Client name and email are required.');
      return;
    }
    setSubmitting(true);
    try {
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
      propertyType: (form.propertyType === 'Other' ? form.propertyTypeOther : form.propertyType).trim(),
      bedrooms: Number(form.bedrooms) || 3,
      bathrooms: Number(form.bathrooms) || 2,
      agreementStatus: 'pending',
      agreementUrl: '',
      agreementSignToken: '', agreementSentAt: '', agreementSignerName: '', agreementSignedAt: '', agreementSignerIp: '', agreementSignatureImage: '',
      agreementFeeText: '', agreementTermsText: '', agreementClauses: '', agreementBodyHtml: '',
      invoiceIds: [],
      assignedTo: currentUser?.id ?? '',
      aiConsentStatus: 'pending',
      aiConsentDate: '',
    });
    if (form.clientId) addDealToClient(form.clientId, deal.id);
    setForm({ clientName: '', clientEmail: '', clientPhone: '', brief: '', budget: '', fee: '', feeType: 'fixed', propertyType: '', propertyTypeOther: '', bedrooms: '3', bathrooms: '2', preferredSuburbs: '', clientId: '' });
    setShowAddDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create buyer journey.');
    } finally {
      setSubmitting(false);
    }
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
      <PageHeader
        eyebrow="Engagements"
        title="Buyer Journeys"
        subtitle="Manage every buyer journey from qualification to settlement."
        actions={
          canCreate && (
            <Button onClick={() => setShowAddDialog(true)} className="shadow-md shadow-primary/25 h-10">
              <Plus className="mr-2 h-3.5 w-3.5" />
              New Buyer Journey
            </Button>
          )
        }
      />

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
      {!dealsLoaded ? (
        <CardGridSkeleton />
      ) : filteredDeals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={stageFilter ? `No ${STAGE_LABELS[stageFilter as DealStage]} journeys` : 'No buyer journeys yet'}
          description={stageFilter ? 'Try a different stage filter.' : 'Create your first buyer journey or convert a qualified lead.'}
          action={!stageFilter && canCreate && (
            <Button className="shadow-md shadow-primary/20" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />Create your first buyer journey
            </Button>
          )}
        />
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
      <Sheet open={showAddDialog} onOpenChange={(o) => { if (submitting) return; setShowAddDialog(o); }}>
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
                <Select id="propertyType" value={form.propertyType} onChange={(e) => setForm((f) => ({ ...f, propertyType: e.target.value, propertyTypeOther: '' }))} className="h-10 w-full">
                  <option value="">Select a property type...</option>
                  <optgroup label="— Popular —">
                    {popularPropertyTypes.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </optgroup>
                  <optgroup label="— More options —">
                    {standardPropertyTypes.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </optgroup>
                </Select>
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
            {form.propertyType === 'Other' && (
              <div className="space-y-1.5">
                <Label htmlFor="propertyTypeOther">Specify property type</Label>
                <Input id="propertyTypeOther" value={form.propertyTypeOther} onChange={(e) => setForm((f) => ({ ...f, propertyTypeOther: e.target.value }))} placeholder="Please describe the property type..." />
              </div>
            )}
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
              <SheetClose asChild><Button type="button" variant="ghost" disabled={submitting}>Cancel</Button></SheetClose>
              <Button type="submit" loading={submitting} disabled={!form.clientName.trim() || !form.clientEmail.trim()} className="shadow-sm shadow-primary/20">
                {!submitting && <Plus className="mr-2 h-4 w-4" />}{submitting ? 'Creating…' : 'Create Buyer Journey'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
}