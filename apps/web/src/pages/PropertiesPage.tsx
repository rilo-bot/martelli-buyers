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
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Plus, Search, Home, MapPin, Star, ArrowRight, Building2, ChevronRight, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isVideoUrl } from '@/lib/upload';
import { PROPERTY_STATUS_PILL } from '@/lib/statusStyles';
import type { PropertyStatus } from '@/types';

export default function PropertiesPage() {
  const properties = usePropertiesStore((s) => s.properties);
  const propertiesLoaded = usePropertiesStore((s) => s.loaded);
  const offMarket = useOffMarketStore((s) => s.properties);
  const offMarketLoaded = useOffMarketStore((s) => s.loaded);
  const addOffMarket = useOffMarketStore((s) => s.addProperty);
  const toggleActive = useOffMarketStore((s) => s.toggleActive);
  const agents = useAgentsStore((s) => s.agents);
  const { can } = usePermissions();
  const canCreateProperty = can('properties:create');

  const [search, setSearch] = useState('');
  const [showAddOffMarket, setShowAddOffMarket] = useState(false);

  const [omForm, setOmForm] = useState({
    address: '', suburb: '', priceGuide: '', priceLow: '', priceHigh: '',
    bedrooms: '3', bathrooms: '2', carparks: '1', propertyType: '',
    notes: '', sourceAgentId: '', sourceAgentName: '',
  });

  // '__manual__' lets the user type a name for an agent not yet in the network.
  const MANUAL = '__manual__';

  const debouncedSearch = useDebouncedValue(search, 200);
  const filteredProperties = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return properties.filter((p) => !q || p.address.toLowerCase().includes(q) || p.suburb.toLowerCase().includes(q));
  }, [properties, debouncedSearch]);

  const filteredOffMarket = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return offMarket.filter((p) => !q || p.address.toLowerCase().includes(q) || p.suburb.toLowerCase().includes(q));
  }, [offMarket, debouncedSearch]);

  const handleAddOffMarket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!omForm.address.trim()) return;
    addOffMarket({
      address: omForm.address.trim(),
      suburb: omForm.suburb.trim(),
      priceGuide: omForm.priceGuide.trim(),
      priceLow: Number(omForm.priceLow) || 0,
      priceHigh: Number(omForm.priceHigh) || 0,
      bedrooms: Number(omForm.bedrooms) || 3,
      bathrooms: Number(omForm.bathrooms) || 2,
      carparks: Number(omForm.carparks) || 1,
      propertyType: omForm.propertyType.trim(),
      notes: omForm.notes.trim(),
      // Link to a real agent record when one was picked; manual entries keep
      // only the typed name so the card still has a source to show.
      sourceAgentId: omForm.sourceAgentId === MANUAL ? '' : omForm.sourceAgentId,
      sourceAgentName: omForm.sourceAgentName.trim(),
      attachments: [],
      usedInDealIds: [],
      isActive: true,
    });
    setOmForm({ address: '', suburb: '', priceGuide: '', priceLow: '', priceHigh: '', bedrooms: '3', bathrooms: '2', carparks: '1', propertyType: '', notes: '', sourceAgentId: '', sourceAgentName: '' });
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
            <Button onClick={() => setShowAddOffMarket(true)} className="shadow-md shadow-primary/25 h-10">
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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by address or suburb..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      <Tabs defaultValue="deal">
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
              title={search ? 'No matching properties' : 'No deal properties yet'}
              description={search
                ? 'Try a different address or suburb.'
                : 'Properties are added when you track them against a buyer journey. Open a journey to add properties.'}
              action={!search && (
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
                title={search ? 'No matching off-market properties' : 'No off-market properties yet'}
                description={search
                  ? 'Try a different address or suburb.'
                  : 'Build your centralised off-market database to stop losing track of exclusive listings across spreadsheets.'}
                action={!search && canCreateProperty && (
                  <Button onClick={() => setShowAddOffMarket(true)}>
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
                        <Badge
                          variant={prop.isActive ? 'default' : 'secondary'}
                          className="text-[10px] px-2 py-0.5 shrink-0 font-semibold"
                        >
                          {prop.isActive ? 'Active' : 'Inactive'}
                        </Badge>
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
                      <div className="flex justify-end border-t border-border/50 pt-2">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => toggleActive(prop.id)}>
                          {prop.isActive ? 'Mark Inactive' : 'Mark Active'}
                        </Button>
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

      {/* Add Off-Market drawer */}
      <Sheet open={showAddOffMarket} onOpenChange={setShowAddOffMarket}>
        <SheetContent size="lg">
          <SheetHeader><SheetTitle>Add Off-Market Property</SheetTitle></SheetHeader>
          <form onSubmit={handleAddOffMarket} className="flex min-h-0 flex-1 flex-col">
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
                <Input id="omType" value={omForm.propertyType} onChange={(e) => setOmForm((f) => ({ ...f, propertyType: e.target.value }))} placeholder="House" />
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
              <Label htmlFor="omNotes">Notes</Label>
              <Textarea id="omNotes" value={omForm.notes} onChange={(e) => setOmForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            </SheetBody>
            <SheetFooter>
              <SheetClose asChild><Button type="button" variant="ghost">Cancel</Button></SheetClose>
              <Button type="submit" disabled={!omForm.address.trim()} className="shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />Add Property
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </PageTransition>
  );
}