import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useOffMarketStore } from '@/stores/offMarketStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { usePermissions } from '@/lib/permissions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetBody, SheetFooter, SheetClose } from '@/components/ui/sheet';
import { Select } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { MediaUploader } from '@/components/MediaUploader';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Plus, Search, Home, MapPin, Star, ArrowRight, Building2, ChevronRight, User, Pencil, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isVideoUrl } from '@/lib/upload';
import { PROPERTY_STATUS_PILL, OFF_MARKET_STATUS_ORDER, OFF_MARKET_STATUS_LABELS, OFF_MARKET_STATUS_PILL } from '@/lib/statusStyles';
import { PROPERTY_TYPE_OPTIONS } from './leads/leadShared';
import type { PropertyStatus, OffMarketProperty, OffMarketStatus, AgentGeo } from '@/types';

const popularPropertyTypes = PROPERTY_TYPE_OPTIONS.filter((o) => o.group === 'popular');
const standardPropertyTypes = PROPERTY_TYPE_OPTIONS.filter((o) => o.group === 'standard');

// — Filter option sets, shared by both property tabs —
const REGION_OPTIONS: AgentGeo[] = ['East', 'West', 'North', 'Central'];

const PRICE_BANDS = [
  { value: 'u1', label: 'Under $1M', min: 0, max: 1_000_000 },
  { value: '1-1.5', label: '$1M – $1.5M', min: 1_000_000, max: 1_500_000 },
  { value: '1.5-2', label: '$1.5M – $2M', min: 1_500_000, max: 2_000_000 },
  { value: '2-3', label: '$2M – $3M', min: 2_000_000, max: 3_000_000 },
  { value: '3plus', label: '$3M+', min: 3_000_000, max: Infinity },
] as const;

const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5'];

const UPDATED_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

/** True when `value` (a dollar amount) falls inside the selected price band. */
function priceInBand(value: number, bandKey: string): boolean {
  if (!bandKey) return true;
  const band = PRICE_BANDS.find((b) => b.value === bandKey);
  if (!band) return true;
  if (!value || value <= 0) return false; // unknown price → excluded once a band is chosen
  return value >= band.min && value < band.max;
}

/** True when `updatedAt` is within `days` of `now` (ms epoch). */
function withinDays(updatedAt: string, days: number, now: number): boolean {
  if (!updatedAt) return false;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return false;
  return now - t <= days * 86_400_000;
}

export default function PropertiesPage() {
  const properties = usePropertiesStore((s) => s.properties);
  const propertiesLoaded = usePropertiesStore((s) => s.loaded);
  const offMarket = useOffMarketStore((s) => s.properties);
  const offMarketLoaded = useOffMarketStore((s) => s.loaded);
  const addOffMarket = useOffMarketStore((s) => s.addProperty);
  const updateOffMarket = useOffMarketStore((s) => s.updateProperty);
  const setOffMarketStatus = useOffMarketStore((s) => s.setStatus);
  const agents = useAgentsStore((s) => s.agents);
  const { can } = usePermissions();
  const canCreateProperty = can('properties:create');
  const canEditProperty = can('properties:edit');

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState('deal');

  // Shared listing filters (region/agent resolve through the source agent record).
  const [region, setRegion] = useState('');
  const [priceBand, setPriceBand] = useState('');
  const [minBeds, setMinBeds] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [omStatusFilter, setOmStatusFilter] = useState('');
  const [updatedWithin, setUpdatedWithin] = useState('');

  const [showAddOffMarket, setShowAddOffMarket] = useState(false);
  // null → the drawer is in "add" mode; an id → editing that off-market record.
  const [editingId, setEditingId] = useState<string | null>(null);

  const [omForm, setOmForm] = useState({
    address: '', suburb: '', priceGuide: '', priceLow: '', priceHigh: '',
    bedrooms: '3', bathrooms: '2', carparks: '1', propertyType: '', propertyTypeOther: '',
    notes: '', sourceAgentId: '', sourceAgentName: '', status: 'available' as OffMarketStatus,
    attachments: [] as string[],
  });

  // '__manual__' lets the user type a name for an agent not yet in the network.
  const MANUAL = '__manual__';

  const debouncedSearch = useDebouncedValue(search, 200);

  // Resolve an agent id to its region (geoTag) so both tabs can filter by region.
  const agentGeoById = useMemo(() => {
    const map: Record<string, AgentGeo> = {};
    for (const a of agents) map[a.id] = a.geoTag;
    return map;
  }, [agents]);

  const filteredProperties = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const now = Date.now();
    return properties.filter((p) => {
      if (q && !p.address.toLowerCase().includes(q) && !p.suburb.toLowerCase().includes(q)) return false;
      if (region && agentGeoById[p.agentId] !== region) return false;
      if (!priceInBand(p.price, priceBand)) return false;
      if (minBeds && p.bedrooms < Number(minBeds)) return false;
      if (agentFilter && p.agentId !== agentFilter) return false;
      if (updatedWithin && !withinDays(p.updatedAt, Number(updatedWithin), now)) return false;
      return true;
    });
  }, [properties, debouncedSearch, region, priceBand, minBeds, agentFilter, updatedWithin, agentGeoById]);

  const filteredOffMarket = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const now = Date.now();
    return offMarket.filter((p) => {
      if (q && !p.address.toLowerCase().includes(q) && !p.suburb.toLowerCase().includes(q)) return false;
      if (region && agentGeoById[p.sourceAgentId] !== region) return false;
      // Off-market records carry a low/high range — use the midpoint (or whichever bound is set).
      const omPrice = p.priceLow && p.priceHigh ? (p.priceLow + p.priceHigh) / 2 : p.priceLow || p.priceHigh || 0;
      if (!priceInBand(omPrice, priceBand)) return false;
      if (minBeds && p.bedrooms < Number(minBeds)) return false;
      if (agentFilter && p.sourceAgentId !== agentFilter) return false;
      if (omStatusFilter && (p.status ?? 'available') !== omStatusFilter) return false;
      if (updatedWithin && !withinDays(p.updatedAt, Number(updatedWithin), now)) return false;
      return true;
    });
  }, [offMarket, debouncedSearch, region, priceBand, minBeds, agentFilter, omStatusFilter, updatedWithin, agentGeoById]);

  const dealFiltersActive = Boolean(search || region || priceBand || minBeds || agentFilter || updatedWithin);
  const omFiltersActive = dealFiltersActive || Boolean(omStatusFilter);
  // Drives the "Clear" button — only the select filters, not the search box.
  const filterSelectsActive = Boolean(region || priceBand || minBeds || agentFilter || omStatusFilter || updatedWithin);

  const clearFilters = () => {
    setRegion('');
    setPriceBand('');
    setMinBeds('');
    setAgentFilter('');
    setOmStatusFilter('');
    setUpdatedWithin('');
  };

  const EMPTY_OM_FORM = { address: '', suburb: '', priceGuide: '', priceLow: '', priceHigh: '', bedrooms: '3', bathrooms: '2', carparks: '1', propertyType: '', propertyTypeOther: '', notes: '', sourceAgentId: '', sourceAgentName: '', status: 'available' as OffMarketStatus, attachments: [] as string[] };

  const openAddOffMarket = () => {
    setEditingId(null);
    setOmForm(EMPTY_OM_FORM);
    setShowAddOffMarket(true);
  };

  const openEditOffMarket = (prop: OffMarketProperty) => {
    setEditingId(prop.id);
    setOmForm({
      address: prop.address,
      suburb: prop.suburb,
      priceGuide: prop.priceGuide,
      priceLow: prop.priceLow ? String(prop.priceLow) : '',
      priceHigh: prop.priceHigh ? String(prop.priceHigh) : '',
      bedrooms: String(prop.bedrooms),
      bathrooms: String(prop.bathrooms),
      carparks: String(prop.carparks),
      // A stored type that isn't one of the preset options is treated as a
      // custom value — select "Other" and surface it in the free-text input.
      propertyType:
        !prop.propertyType || PROPERTY_TYPE_OPTIONS.some((o) => o.value === prop.propertyType && o.value !== 'Other')
          ? prop.propertyType
          : 'Other',
      propertyTypeOther:
        prop.propertyType && !PROPERTY_TYPE_OPTIONS.some((o) => o.value === prop.propertyType && o.value !== 'Other')
          ? prop.propertyType
          : '',
      notes: prop.notes,
      // A stored name with no linked agent id means it was typed manually —
      // re-open in manual mode so the name input stays visible and editable.
      sourceAgentId: prop.sourceAgentId || (prop.sourceAgentName ? MANUAL : ''),
      sourceAgentName: prop.sourceAgentName,
      // Records created before statuses existed default to "available".
      status: prop.status ?? 'available',
      attachments: prop.attachments ?? [],
    });
    setShowAddOffMarket(true);
  };

  const handleSubmitOffMarket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!omForm.address.trim()) return;
    const fields = {
      address: omForm.address.trim(),
      suburb: omForm.suburb.trim(),
      priceGuide: omForm.priceGuide.trim(),
      priceLow: Number(omForm.priceLow) || 0,
      priceHigh: Number(omForm.priceHigh) || 0,
      bedrooms: Number(omForm.bedrooms) || 3,
      bathrooms: Number(omForm.bathrooms) || 2,
      carparks: Number(omForm.carparks) || 1,
      propertyType: (omForm.propertyType === 'Other' ? omForm.propertyTypeOther : omForm.propertyType).trim(),
      notes: omForm.notes.trim(),
      // Link to a real agent record when one was picked; manual entries keep
      // only the typed name so the card still has a source to show.
      sourceAgentId: omForm.sourceAgentId === MANUAL ? '' : omForm.sourceAgentId,
      sourceAgentName: omForm.sourceAgentName.trim(),
      status: omForm.status,
      attachments: omForm.attachments,
    };
    // Mirror the status onto the legacy isActive flag (Active = on the market).
    const isActive = omForm.status === 'available' || omForm.status === 'under_offer';
    if (editingId) {
      updateOffMarket(editingId, { ...fields, isActive });
    } else {
      addOffMarket({ ...fields, usedInDealIds: [], isActive });
    }
    setOmForm(EMPTY_OM_FORM);
    setEditingId(null);
    setShowAddOffMarket(false);
  };

  const activeOffMarket = useMemo(() => offMarket.filter((p) => p.isActive).length, [offMarket]);

  return (
    <PageTransition className="space-y-6">
      {/* Page header */}
      <PageHeader
        eyebrow="Listings"
        title="Properties"
        subtitle="Track deal-specific listings and manage your off-market property database."
        actions={
          canCreateProperty && (
            <Button onClick={openAddOffMarket} className="shadow-md shadow-primary/25 h-10">
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Off-Market
            </Button>
          )
        }
      />

      {/* Stats strip */}
      <Stagger className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Deal Properties', value: properties.length, accent: 'primary' as const },
          { label: 'Off-Market Total', value: offMarket.length, accent: 'info' as const },
          { label: 'Active Off-Market', value: activeOffMarket, accent: 'success' as const },
        ].map((s) => (
          <StaggerItem key={s.label}>
            <StatCard label={s.label} value={s.value} accent={s.accent} />
          </StaggerItem>
        ))}
      </Stagger>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address or suburb..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Region" value={region} onChange={(e) => setRegion(e.target.value)} className="h-9 text-sm" containerClassName="w-36">
            <option value="">All regions</option>
            {REGION_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </Select>

          <Select aria-label="Price" value={priceBand} onChange={(e) => setPriceBand(e.target.value)} className="h-9 text-sm" containerClassName="w-40">
            <option value="">Any price</option>
            {PRICE_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </Select>

          <Select aria-label="Bedrooms" value={minBeds} onChange={(e) => setMinBeds(e.target.value)} className="h-9 text-sm" containerClassName="w-32">
            <option value="">Any beds</option>
            {BEDROOM_OPTIONS.map((b) => <option key={b} value={b}>{b}+ beds</option>)}
          </Select>

          <Select aria-label="Agent" value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="h-9 text-sm" containerClassName="w-44">
            <option value="">All agents</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
          </Select>

          {tab === 'offmarket' && (
            <Select aria-label="Off-market status" value={omStatusFilter} onChange={(e) => setOmStatusFilter(e.target.value)} className="h-9 text-sm" containerClassName="w-40">
              <option value="">All statuses</option>
              {OFF_MARKET_STATUS_ORDER.map((s) => <option key={s} value={s}>{OFF_MARKET_STATUS_LABELS[s]}</option>)}
            </Select>
          )}

          <Select aria-label="Last updated" value={updatedWithin} onChange={(e) => setUpdatedWithin(e.target.value)} className="h-9 text-sm" containerClassName="w-40">
            <option value="">Any time</option>
            {UPDATED_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>

          {filterSelectsActive && (
            <Button variant="ghost" size="sm" className="h-9 text-xs text-muted-foreground" onClick={clearFilters}>
              <X className="mr-1.5 h-3.5 w-3.5" />Clear filters
            </Button>
          )}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-10">
          <TabsTrigger value="deal" className="text-sm">Deal Properties ({properties.length})</TabsTrigger>
          <TabsTrigger value="offmarket" className="text-sm">Off-Market Database ({offMarket.length})</TabsTrigger>
        </TabsList>

        {/* DEAL PROPERTIES */}
        <TabsContent value="deal" className="mt-4">
          {!propertiesLoaded ? (
            <CardGridSkeleton />
          ) : filteredProperties.length === 0 ? (
            <EmptyState
              icon={Home}
              title={dealFiltersActive ? 'No matching properties' : 'No deal properties yet'}
              description={dealFiltersActive
                ? 'Try adjusting your search or filters.'
                : 'Properties are added when you track them against a buyer journey. Open a journey to add properties.'}
              action={!dealFiltersActive && (
                <Button asChild variant="outline">
                  <Link to="/journeys"><ArrowRight className="mr-2 h-4 w-4" />Go to Buyer Journeys</Link>
                </Button>
              )}
            />
          ) : (
            <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" step={0.04}>
              {filteredProperties.map((prop) => {
                const pill = PROPERTY_STATUS_PILL[prop.status as PropertyStatus] ?? PROPERTY_STATUS_PILL.suggested;
                const cover = (prop.photos ?? []).find((u) => !isVideoUrl(u));
                return (
                  <StaggerItem key={prop.id}>
                  <Link to={`/properties/${prop.id}`}>
                    <Card className="group border-border/70 card-interactive h-full bg-card overflow-hidden">
                      {cover && (
                        <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
                          <img src={cover} alt={prop.address} loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                        </div>
                      )}
                      <CardHeader className="pb-2 px-5 pt-5">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/8 border border-primary/15 shrink-0">
                            <Home className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex gap-1.5 flex-wrap justify-end">
                            {prop.isOffMarket && (
                              <Badge variant="secondary" className="text-[10px] px-2 py-0.5 font-semibold">Off-Market</Badge>
                            )}
                            <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-bold border capitalize', pill)}>
                              {prop.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                        <CardTitle className="mt-3 text-[15px] font-bold group-hover:text-primary transition-colors">{prop.address}</CardTitle>
                        <CardDescription className="text-xs flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{prop.suburb}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-5 pb-5">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-semibold text-foreground">{prop.priceGuide || 'Price TBC'}</span>
                          <span>{prop.bedrooms}bd / {prop.bathrooms}ba</span>
                          {prop.propertyType && <span>{prop.propertyType}</span>}
                        </div>
                        <ChevronRight className="mt-3 h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      </CardContent>
                    </Card>
                  </Link>
                  </StaggerItem>
                );
              })}
            </Stagger>
          )}
        </TabsContent>

        {/* OFF-MARKET DATABASE */}
        <TabsContent value="offmarket" className="mt-4">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Centralised off-market property database. Reuse entries across multiple client deals.</p>
            {!offMarketLoaded ? (
              <CardGridSkeleton />
            ) : filteredOffMarket.length === 0 ? (
              <EmptyState
                icon={Building2}
                title={omFiltersActive ? 'No matching off-market properties' : 'No off-market properties yet'}
                description={omFiltersActive
                  ? 'Try adjusting your search or filters.'
                  : 'Build your centralised off-market database to stop losing track of exclusive listings across spreadsheets.'}
                action={!omFiltersActive && canCreateProperty && (
                  <Button onClick={openAddOffMarket}>
                    <Plus className="mr-2 h-4 w-4" />Add your first off-market property
                  </Button>
                )}
              />
            ) : (
              <Stagger className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" step={0.04}>
                {filteredOffMarket.map((prop) => (
                  <StaggerItem key={prop.id}>
                  <Card className="group border-border/70 card-interactive bg-card h-full">
                    <CardHeader className="pb-2 px-5 pt-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-[15px] font-bold truncate">{prop.address}</CardTitle>
                          <CardDescription className="text-xs flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3 shrink-0" />{prop.suburb}
                          </CardDescription>
                        </div>
                        <span className={cn(
                          'text-[10px] px-2.5 py-1 rounded-full font-bold border shrink-0',
                          OFF_MARKET_STATUS_PILL[prop.status ?? 'available'],
                        )}>
                          {OFF_MARKET_STATUS_LABELS[prop.status ?? 'available']}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 px-5 pb-5">
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{prop.priceGuide || 'Price TBC'}</span>
                        <span>{prop.bedrooms}bd / {prop.bathrooms}ba</span>
                        {prop.propertyType && <span className="col-span-2">{prop.propertyType}</span>}
                      </div>
                      {prop.sourceAgentName && (() => {
                        const linked = prop.sourceAgentId ? agents.find((a) => a.id === prop.sourceAgentId) : null;
                        return (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {linked?.isPreferred
                              ? <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
                              : <User className="h-3.5 w-3.5 shrink-0" />}
                            <span>Source: {prop.sourceAgentName}</span>
                            {linked && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/8 text-primary border border-primary/15 font-semibold">
                                {linked.geoTag}
                              </span>
                            )}
                          </div>
                        );
                      })()}
                      {prop.notes && <p className="text-xs text-muted-foreground line-clamp-2">{prop.notes}</p>}
                      {prop.usedInDealIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">Used in {prop.usedInDealIds.length} deal(s)</p>
                      )}
                      <div className="flex items-center justify-between gap-1 border-t border-border/50 pt-2">
                        {canEditProperty ? (
                          <Select
                            aria-label="Status"
                            value={prop.status ?? 'available'}
                            onChange={(e) => setOffMarketStatus(prop.id, e.target.value as OffMarketStatus)}
                            className="h-7 w-auto text-xs"
                          >
                            {OFF_MARKET_STATUS_ORDER.map((s) => (
                              <option key={s} value={s}>{OFF_MARKET_STATUS_LABELS[s]}</option>
                            ))}
                          </Select>
                        ) : <span />}
                        {canEditProperty && (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEditOffMarket(prop)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Off-Market drawer */}
      <Sheet open={showAddOffMarket} onOpenChange={(open) => { setShowAddOffMarket(open); if (!open) setEditingId(null); }}>
        <SheetContent size="lg">
          <SheetHeader><SheetTitle>{editingId ? 'Edit Off-Market Property' : 'Add Off-Market Property'}</SheetTitle></SheetHeader>
          <form onSubmit={handleSubmitOffMarket} className="flex min-h-0 flex-1 flex-col">
            <SheetBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="omAddress">Street address *</Label>
              <Input id="omAddress" value={omForm.address} onChange={(e) => setOmForm((f) => ({ ...f, address: e.target.value }))} placeholder="12 Example St" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="omSuburb">Suburb</Label>
                <Input id="omSuburb" value={omForm.suburb} onChange={(e) => setOmForm((f) => ({ ...f, suburb: e.target.value }))} placeholder="Remuera" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="omPriceGuide">Price guide</Label>
                <Input id="omPriceGuide" value={omForm.priceGuide} onChange={(e) => setOmForm((f) => ({ ...f, priceGuide: e.target.value }))} placeholder="$1.2M - $1.4M" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="omPriceLow">Price low ($)</Label>
                <Input id="omPriceLow" type="number" value={omForm.priceLow} onChange={(e) => setOmForm((f) => ({ ...f, priceLow: e.target.value }))} placeholder="1200000" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="omPriceHigh">Price high ($)</Label>
                <Input id="omPriceHigh" type="number" value={omForm.priceHigh} onChange={(e) => setOmForm((f) => ({ ...f, priceHigh: e.target.value }))} placeholder="1400000" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="omBeds">Beds</Label>
                <Input id="omBeds" type="number" min="1" value={omForm.bedrooms} onChange={(e) => setOmForm((f) => ({ ...f, bedrooms: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="omBaths">Baths</Label>
                <Input id="omBaths" type="number" min="1" value={omForm.bathrooms} onChange={(e) => setOmForm((f) => ({ ...f, bathrooms: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="omCars">Cars</Label>
                <Input id="omCars" type="number" min="0" value={omForm.carparks} onChange={(e) => setOmForm((f) => ({ ...f, carparks: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="omType">Property type</Label>
                <Select id="omType" value={omForm.propertyType} onChange={(e) => setOmForm((f) => ({ ...f, propertyType: e.target.value, propertyTypeOther: '' }))} className="h-10 w-full">
                  <option value="">Select a property type...</option>
                  <optgroup label="— Popular —">
                    {popularPropertyTypes.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </optgroup>
                  <optgroup label="— More options —">
                    {standardPropertyTypes.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </optgroup>
                </Select>
                {omForm.propertyType === 'Other' && (
                  <Input value={omForm.propertyTypeOther} onChange={(e) => setOmForm((f) => ({ ...f, propertyTypeOther: e.target.value }))} placeholder="Please describe the property type..." className="mt-2" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="omAgent">Source agent</Label>
                <Select
                  id="omAgent"
                  value={omForm.sourceAgentId}
                  onChange={(e) => {
                    const val = e.target.value;
                    const agent = agents.find((a) => a.id === val);
                    setOmForm((f) => ({
                      ...f,
                      sourceAgentId: val,
                      sourceAgentName: agent
                        ? `${agent.firstName} ${agent.lastName}`.trim()
                        : val === MANUAL
                          ? f.sourceAgentName
                          : '',
                    }));
                  }}
                >
                  <option value="">— None —</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.firstName} {a.lastName}{a.agency ? ` — ${a.agency}` : ''}{a.isPreferred ? ' ★' : ''}
                    </option>
                  ))}
                  <option value={MANUAL}>Other (enter manually)…</option>
                </Select>
                {omForm.sourceAgentId === MANUAL && (
                  <Input
                    className="mt-2"
                    value={omForm.sourceAgentName}
                    onChange={(e) => setOmForm((f) => ({ ...f, sourceAgentName: e.target.value }))}
                    placeholder="Agent name"
                  />
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="omStatus">Status</Label>
              <Select
                id="omStatus"
                value={omForm.status}
                onChange={(e) => setOmForm((f) => ({ ...f, status: e.target.value as OffMarketStatus }))}
                className="h-10 w-full"
              >
                {OFF_MARKET_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>{OFF_MARKET_STATUS_LABELS[s]}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="omNotes">Notes</Label>
              <Textarea id="omNotes" value={omForm.notes} onChange={(e) => setOmForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Photos, videos & documents</Label>
              <MediaUploader
                value={omForm.attachments}
                onChange={(next) => setOmForm((f) => ({ ...f, attachments: next }))}
                scope="off-market"
                scopeId={editingId ?? undefined}
                compact
              />
            </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
              <Button type="submit" disabled={!omForm.address.trim()} className="shadow-sm shadow-primary/20">
                {editingId ? (
                  <><Pencil className="mr-2 h-4 w-4" />Save Changes</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" />Add Property</>
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}