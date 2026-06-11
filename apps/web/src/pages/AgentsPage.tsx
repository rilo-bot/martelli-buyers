import { useState, useMemo } from 'react';
import { useAgentsStore } from '@/stores/agentsStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Plus, Search, Users, Star, Phone, Mail, MapPin, Edit } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { AgentGeo } from '@/types';

const GEO_OPTIONS: AgentGeo[] = ['East', 'West', 'North', 'Central'];

const GEO_CONFIG: Record<AgentGeo, { pill: string; dot: string; cardBorder: string }> = {
  East: {
    pill: 'bg-primary/8 text-primary border-primary/20',
    dot: 'bg-primary',
    cardBorder: 'border-l-primary/40',
  },
  West: {
    pill: 'bg-violet-500/8 text-violet-700 dark:text-violet-400 border-violet-500/20',
    dot: 'bg-violet-500',
    cardBorder: 'border-l-violet-400/40',
  },
  North: {
    pill: 'bg-emerald-500/8 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
    dot: 'bg-emerald-500',
    cardBorder: 'border-l-emerald-400/40',
  },
  Central: {
    pill: 'bg-orange-500/8 text-orange-700 dark:text-orange-400 border-orange-500/20',
    dot: 'bg-orange-500',
    cardBorder: 'border-l-orange-400/40',
  },
};

export default function AgentsPage() {
  const agents = useAgentsStore((s) => s.agents);
  const addAgent = useAgentsStore((s) => s.addAgent);
  const updateAgent = useAgentsStore((s) => s.updateAgent);
  const deleteAgent = useAgentsStore((s) => s.deleteAgent);
  const togglePreferred = useAgentsStore((s) => s.togglePreferred);

  const [search, setSearch] = useState('');
  const [geoFilter, setGeoFilter] = useState('');
  const [preferredOnly, setPreferredOnly] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', agency: '',
    geoTag: 'Central' as AgentGeo, suburbs: '', isPreferred: false, notes: '',
  });

  const filteredAgents = useMemo(() => {
    const q = search.toLowerCase();
    return agents.filter((a) => {
      const matchesSearch = !q || `${a.firstName} ${a.lastName} ${a.email} ${a.agency}`.toLowerCase().includes(q);
      const matchesGeo = !geoFilter || a.geoTag === geoFilter;
      const matchesPreferred = !preferredOnly || a.isPreferred;
      return matchesSearch && matchesGeo && matchesPreferred;
    });
  }, [agents, search, geoFilter, preferredOnly]);

  const stats = useMemo(() => {
    const byGeo = GEO_OPTIONS.reduce((acc, geo) => {
      acc[geo] = agents.filter((a) => a.geoTag === geo).length;
      return acc;
    }, {} as Record<AgentGeo, number>);
    return { total: agents.length, preferred: agents.filter((a) => a.isPreferred).length, byGeo };
  }, [agents]);

  const openAdd = () => {
    setEditId(null);
    setForm({ firstName: '', lastName: '', email: '', phone: '', agency: '', geoTag: 'Central', suburbs: '', isPreferred: false, notes: '' });
    setShowAddDialog(true);
  };

  const openEdit = (id: string) => {
    const agent = agents.find((a) => a.id === id);
    if (!agent) return;
    setEditId(id);
    setForm({
      firstName: agent.firstName, lastName: agent.lastName, email: agent.email,
      phone: agent.phone, agency: agent.agency, geoTag: agent.geoTag,
      suburbs: agent.suburbs.join(', '), isPreferred: agent.isPreferred, notes: agent.notes,
    });
    setShowAddDialog(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      toast.error('First name and last name are required.');
      return;
    }
    const data = {
      firstName: form.firstName.trim(), lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(), phone: form.phone.trim(),
      agency: form.agency.trim(), geoTag: form.geoTag,
      suburbs: form.suburbs.split(',').map((s) => s.trim()).filter(Boolean),
      isPreferred: form.isPreferred, notes: form.notes.trim(),
      lastContactDate: '', dealsReferredIds: [],
    };
    if (editId) {
      updateAgent(editId, data);
    } else {
      addAgent(data);
    }
    setShowAddDialog(false);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-eyebrow mb-1.5">Network</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Agent Database</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your agent network with geographic segmentation and preferred tagging.</p>
        </div>
        <Button onClick={openAdd} className="shadow-md shadow-primary/25 h-9">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Agent
        </Button>
      </div>

      {/* Stats row — summary + geo breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* Total / Preferred */}
        <Card className="md:col-span-2 border-border/70 shadow-sm">
          <CardContent className="pt-5 pb-5 px-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/15">
                <Users className="h-[18px] w-[18px] text-primary" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                {stats.preferred} preferred
              </span>
            </div>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Total Agents</p>
            <p className="text-3xl font-bold tabular-nums">{stats.total}</p>
            <p className="text-xs text-muted-foreground mt-1">{stats.total === 0 ? 'No agents yet' : 'in your network'}</p>
          </CardContent>
        </Card>

        {/* Geo breakdown cards */}
        {GEO_OPTIONS.map((geo) => {
          const config = GEO_CONFIG[geo];
          const isFiltered = geoFilter === geo;
          return (
            <Card
              key={geo}
              className={cn(
                'cursor-pointer border-border/70 shadow-sm kpi-card transition-all border-l-4',
                config.cardBorder,
                isFiltered && 'ring-2 ring-primary/30'
              )}
              onClick={() => setGeoFilter(isFiltered ? '' : geo)}
            >
              <CardContent className="pt-4 pb-4 px-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={cn('h-2 w-2 rounded-full shrink-0', config.dot)} />
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{geo}</p>
                </div>
                <span className={cn('text-2xl font-bold tabular-nums', isFiltered && 'text-primary')}>{stats.byGeo[geo]}</span>
                <p className="text-[11px] text-muted-foreground mt-0.5">agents</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name, agency or suburb..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
        </div>
        <Select value={geoFilter} onChange={(e) => setGeoFilter(e.target.value)} className="w-40 h-10">
          <option value="">All regions</option>
          {GEO_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
        </Select>
        <button
          type="button"
          onClick={() => setPreferredOnly((v) => !v)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all h-10',
            preferredOnly
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
              : 'bg-card border-border hover:bg-muted text-muted-foreground'
          )}
        >
          <Star className={cn('h-4 w-4', preferredOnly ? 'fill-amber-500 text-amber-500' : '')} />
          Preferred only
        </button>
      </div>

      {/* Agents grid */}
      {filteredAgents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-5">
            <Users className="h-8 w-8 text-primary/40" />
          </div>
          <h3 className="text-lg font-bold">
            {geoFilter ? `No ${geoFilter} agents` : preferredOnly ? 'No preferred agents yet' : 'No agents yet'}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {geoFilter || preferredOnly
              ? 'Try adjusting your filters.'
              : 'Build your agent network. Add agents with geographic tags to enable targeted requirement blasts.'}
          </p>
          {!geoFilter && !preferredOnly && (
            <Button className="mt-5 shadow-md shadow-primary/20" onClick={openAdd}>
              <Plus className="mr-2 h-4 w-4" />Add your first agent
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => {
            const config = GEO_CONFIG[agent.geoTag];
            const initials = `${agent.firstName[0]}${agent.lastName[0]}`.toUpperCase();
            return (
              <Card key={agent.id} className={cn('group border-border/70 card-interactive border-l-4', config.cardBorder)}>
                <CardHeader className="pb-3 px-5 pt-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold shrink-0 border"
                        style={{
                          background: 'linear-gradient(135deg, hsl(213 94% 38% / 0.10), hsl(174 72% 38% / 0.06))',
                          borderColor: 'hsl(213 94% 38% / 0.16)',
                          color: 'hsl(213 94% 38%)',
                        }}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <CardTitle className="text-[15px] font-bold truncate">{agent.firstName} {agent.lastName}</CardTitle>
                          {agent.isPreferred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
                        </div>
                        <CardDescription className="text-[11px] truncate">{agent.agency}</CardDescription>
                      </div>
                    </div>
                    <Badge
                      className={cn('text-[10px] px-2.5 py-1 shrink-0 font-bold border', config.pill)}
                      variant="secondary"
                    >
                      {agent.geoTag}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 px-5 pb-5">
                  {agent.email && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{agent.email}</span>
                    </div>
                  )}
                  {agent.phone && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" /><span>{agent.phone}</span>
                    </div>
                  )}
                  {agent.suburbs.length > 0 && (
                    <div className="flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{agent.suburbs.slice(0, 3).join(', ')}{agent.suburbs.length > 3 ? ` +${agent.suburbs.length - 3}` : ''}</span>
                    </div>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => openEdit(agent.id)}>
                      <Edit className="mr-1.5 h-3 w-3" />Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={agent.isPreferred ? 'secondary' : 'ghost'}
                      className={cn('h-8 px-3', agent.isPreferred ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800' : '')}
                      onClick={() => togglePreferred(agent.id)}
                      aria-label={agent.isPreferred ? 'Remove preferred' : 'Mark preferred'}
                    >
                      <Star className={cn('h-3.5 w-3.5', agent.isPreferred ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground')} />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 px-3 hover:text-destructive hover:bg-destructive/8 text-muted-foreground text-base leading-none"
                      onClick={() => deleteAgent(agent.id)}
                      aria-label="Delete agent"
                    >
                      ×
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit Agent' : 'Add Agent'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="agentFN">First name *</Label>
                <Input id="agentFN" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="John" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agentLN">Last name *</Label>
                <Input id="agentLN" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Smith" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agentEmail">Email</Label>
              <Input id="agentEmail" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="john@agency.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="agentPhone">Phone</Label>
                <Input id="agentPhone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="+64 9 xxx xxxx" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agentAgency">Agency</Label>
                <Input id="agentAgency" value={form.agency} onChange={(e) => setForm((f) => ({ ...f, agency: e.target.value }))} placeholder="Barfoot & Thompson" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="agentGeo">Region *</Label>
                <Select id="agentGeo" value={form.geoTag} onChange={(e) => setForm((f) => ({ ...f, geoTag: e.target.value as AgentGeo }))}>
                  {GEO_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="invisible">Preferred</Label>
                <label className="flex items-center gap-2 text-sm cursor-pointer h-10 px-3 rounded-lg border border-border hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    checked={form.isPreferred}
                    onChange={(e) => setForm((f) => ({ ...f, isPreferred: e.target.checked }))}
                    className="rounded"
                  />
                  <Star className="h-4 w-4 text-amber-400" />
                  <span className="text-muted-foreground">Mark preferred</span>
                </label>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agentSuburbs">Suburbs (comma-separated)</Label>
              <Input id="agentSuburbs" value={form.suburbs} onChange={(e) => setForm((f) => ({ ...f, suburbs: e.target.value }))} placeholder="Remuera, Newmarket, Epsom" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agentNotes">Notes</Label>
              <Textarea id="agentNotes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
              <Button type="submit" disabled={!form.firstName.trim() || !form.lastName.trim()} className="shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />{editId ? 'Save Changes' : 'Add Agent'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}