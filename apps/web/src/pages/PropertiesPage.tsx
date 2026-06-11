import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useOffMarketStore } from '@/stores/offMarketStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Search, Home, MapPin, Star, ArrowRight, Building2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isVideoUrl } from '@/lib/upload';

const PROP_STATUS_CONFIG: Record<string, { pill: string; dot: string }> = {
  active: { pill: 'bg-primary/8 text-primary border-primary/20', dot: 'bg-primary' },
  shortlisted: { pill: 'bg-amber-500/8 text-amber-700 dark:text-amber-400 border-amber-500/20', dot: 'bg-amber-500' },
  inspected: { pill: 'bg-violet-500/8 text-violet-700 dark:text-violet-400 border-violet-500/20', dot: 'bg-violet-500' },
  passed: { pill: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' },
  offer_made: { pill: 'bg-orange-500/8 text-orange-700 dark:text-orange-400 border-orange-500/20', dot: 'bg-orange-500' },
  purchased: { pill: 'bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-500' },
};

export default function PropertiesPage() {
  const properties = usePropertiesStore((s) => s.properties);
  const offMarket = useOffMarketStore((s) => s.properties);
  const addOffMarket = useOffMarketStore((s) => s.addProperty);
  const toggleActive = useOffMarketStore((s) => s.toggleActive);

  const [search, setSearch] = useState('');
  const [showAddOffMarket, setShowAddOffMarket] = useState(false);

  const [omForm, setOmForm] = useState({
    address: '', suburb: '', priceGuide: '', priceLow: '', priceHigh: '',
    bedrooms: '3', bathrooms: '2', carparks: '1', propertyType: '',
    notes: '', sourceAgentName: '',
  });

  const filteredProperties = useMemo(() => {
    const q = search.toLowerCase();
    return properties.filter((p) => !q || p.address.toLowerCase().includes(q) || p.suburb.toLowerCase().includes(q));
  }, [properties, search]);

  const filteredOffMarket = useMemo(() => {
    const q = search.toLowerCase();
    return offMarket.filter((p) => !q || p.address.toLowerCase().includes(q) || p.suburb.toLowerCase().includes(q));
  }, [offMarket, search]);

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
      sourceAgentId: '',
      sourceAgentName: omForm.sourceAgentName.trim(),
      attachments: [],
      usedInDealIds: [],
      isActive: true,
    });
    setOmForm({ address: '', suburb: '', priceGuide: '', priceLow: '', priceHigh: '', bedrooms: '3', bathrooms: '2', carparks: '1', propertyType: '', notes: '', sourceAgentName: '' });
    setShowAddOffMarket(false);
  };

  const activeOffMarket = useMemo(() => offMarket.filter((p) => p.isActive).length, [offMarket]);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-eyebrow mb-1.5">Listings</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-sm text-muted-foreground mt-1">Track deal-specific listings and manage your off-market property database.</p>
        </div>
        <Button onClick={() => setShowAddOffMarket(true)} className="shadow-md shadow-primary/25 h-9">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Off-Market
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Deal Properties', value: properties.length, accent: 'bg-primary/6 border-primary/15', text: 'text-primary' },
          { label: 'Off-Market Total', value: offMarket.length, accent: 'bg-violet-500/6 border-violet-500/15', text: 'text-violet-700 dark:text-violet-400' },
          { label: 'Active Off-Market', value: activeOffMarket, accent: 'bg-emerald-500/6 border-emerald-500/15', text: 'text-emerald-700 dark:text-emerald-400' },
        ].map((s) => (
          <Card key={s.label} className={cn('border kpi-card', s.accent)}>
            <CardContent className="pt-4 pb-4 px-5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">{s.label}</p>
              <p className={cn('text-2xl font-bold mt-1 tabular-nums', s.text)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

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
          {filteredProperties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-5">
                <Home className="h-8 w-8 text-primary/40" />
              </div>
              <h3 className="text-lg font-bold">No deal properties yet</h3>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                Properties are added when you track them against a deal. Visit a deal to add properties.
              </p>
              <Button asChild className="mt-5" variant="outline">
                <Link to="/deals"><ArrowRight className="mr-2 h-4 w-4" />Go to Deals</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProperties.map((prop) => {
                const config = PROP_STATUS_CONFIG[prop.status] ?? PROP_STATUS_CONFIG['active'];
                const cover = (prop.photos ?? []).find((u) => !isVideoUrl(u));
                return (
                  <Link key={prop.id} to={`/properties/${prop.id}`}>
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
                            <span className={cn('text-[10px] px-2.5 py-1 rounded-full font-bold border capitalize', config.pill)}>
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
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* OFF-MARKET DATABASE */}
        <TabsContent value="offmarket" className="mt-4">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Centralised off-market property database. Reuse entries across multiple client deals.</p>
            {filteredOffMarket.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-5">
                  <Building2 className="h-8 w-8 text-primary/40" />
                </div>
                <h3 className="text-lg font-bold">No off-market properties yet</h3>
                <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
                  Build your centralised off-market database to stop losing track of exclusive listings across spreadsheets.
                </p>
                <Button className="mt-5 shadow-md shadow-primary/20" onClick={() => setShowAddOffMarket(true)}>
                  <Plus className="mr-2 h-4 w-4" />Add your first off-market property
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredOffMarket.map((prop) => (
                  <Card key={prop.id} className="group border-border/70 card-interactive bg-card">
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
                      {prop.sourceAgentName && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                          <span>Source: {prop.sourceAgentName}</span>
                        </div>
                      )}
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
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Off-Market Dialog */}
      <Dialog open={showAddOffMarket} onOpenChange={setShowAddOffMarket}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Off-Market Property</DialogTitle></DialogHeader>
          <form onSubmit={handleAddOffMarket} className="space-y-4">
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
                <Input id="omAgent" value={omForm.sourceAgentName} onChange={(e) => setOmForm((f) => ({ ...f, sourceAgentName: e.target.value }))} placeholder="Agent name" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="omNotes">Notes</Label>
              <Textarea id="omNotes" value={omForm.notes} onChange={(e) => setOmForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={!omForm.address.trim()} className="shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />Add Property
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}