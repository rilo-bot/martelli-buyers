import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useClientsStore } from '@/stores/clientsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useLeadsStore } from '@/stores/leadsStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Plus, Search, Users, ArrowRight, Phone, Mail, Building2, FileText, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Client } from '@/types';

export default function ClientsPage() {
  const clients = useClientsStore((s) => s.clients);
  const addClient = useClientsStore((s) => s.addClient);
  const deleteClient = useClientsStore((s) => s.deleteClient);
  const deals = useDealsStore((s) => s.deals);
  const leads = useLeadsStore((s) => s.leads);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [search, setSearch] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', company: '', notes: '', tags: '',
  });

  const filteredClients = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => {
      const fullName = `${c.firstName} ${c.lastName}`.toLowerCase();
      return fullName.includes(q) || c.email.toLowerCase().includes(q) || c.company.toLowerCase().includes(q);
    });
  }, [clients, search]);

  const getClientDeals = (client: Client) => deals.filter((d) => client.dealIds.includes(d.id));
  const getClientLeads = (client: Client) => leads.filter((l) => client.leadIds.includes(l.id));

  const stats = useMemo(() => ({
    total: clients.length,
    active: deals.filter((d) => d.clientId && d.stage !== 'complete').length,
    completed: deals.filter((d) => d.clientId && d.stage === 'complete').length,
  }), [clients, deals]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      toast.error('First name, last name and email are required.');
      return;
    }
    addClient({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim().toLowerCase(),
      phone: form.phone.trim(),
      company: form.company.trim(),
      notes: form.notes.trim(),
      leadIds: [],
      dealIds: [],
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      assignedTo: currentUser?.id ?? '',
    });
    setForm({ firstName: '', lastName: '', email: '', phone: '', company: '', notes: '', tags: '' });
    setShowAddDialog(false);
    toast.success('Client added.');
  };

  const handleDelete = (id: string) => {
    deleteClient(id);
    setDeleteTargetId(null);
    toast.success('Client removed.');
  };

  const deleteTarget = deleteTargetId ? clients.find((c) => c.id === deleteTargetId) : null;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-eyebrow mb-1.5">Relationships</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">All buyer clients, linked to their leads and active deals.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)} className="shadow-md shadow-primary/25 h-9">
          <Plus className="mr-2 h-3.5 w-3.5" />
          Add Client
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Clients', value: stats.total, accent: 'bg-primary/8 border-primary/15', textAccent: 'text-primary' },
          { label: 'Active Deals', value: stats.active, accent: 'bg-emerald-500/8 border-emerald-500/15', textAccent: 'text-emerald-700 dark:text-emerald-400' },
          { label: 'Completed', value: stats.completed, accent: 'bg-muted border-border', textAccent: 'text-muted-foreground' },
        ].map((s) => (
          <Card key={s.label} className={cn('border kpi-card', s.accent)}>
            <CardContent className="pt-4 pb-4 px-5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest font-semibold">{s.label}</p>
              <p className={cn('text-2xl font-bold mt-1 tabular-nums', s.textAccent)}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Client grid */}
      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/6 border-2 border-dashed border-primary/20 mb-5">
            <Users className="h-8 w-8 text-primary/40" />
          </div>
          <h3 className="text-lg font-bold">
            {search ? 'No clients match your search' : 'No clients yet'}
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground leading-relaxed">
            {search
              ? 'Try a different name, email or company.'
              : 'Clients are created automatically when you mark a lead as Won, or add one manually.'}
          </p>
          {!search && (
            <Button className="mt-5 shadow-md shadow-primary/20" onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add your first client
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredClients.map((client) => {
            const clientDeals = getClientDeals(client);
            const clientLeads = getClientLeads(client);
            const activeDeals = clientDeals.filter((d) => d.stage !== 'complete');
            const initials = `${client.firstName[0]}${client.lastName[0]}`.toUpperCase();

            return (
              <Card
                key={client.id}
                className="group border-border/70 card-interactive bg-card"
              >
                <CardHeader className="pb-3 px-5 pt-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold shrink-0 border"
                      style={{
                        background: 'linear-gradient(135deg, hsl(213 94% 38% / 0.12), hsl(174 72% 38% / 0.08))',
                        borderColor: 'hsl(213 94% 38% / 0.20)',
                        color: 'hsl(213 94% 38%)',
                      }}
                    >
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-[15px] font-bold group-hover:text-primary transition-colors truncate">
                        {client.firstName} {client.lastName}
                      </CardTitle>
                      {client.company && (
                        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 truncate">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {client.company}
                        </p>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 px-5 pb-5">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Deal + lead counters */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                      'inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-bold border',
                      activeDeals.length > 0
                        ? 'bg-primary/8 text-primary border-primary/20'
                        : 'bg-muted text-muted-foreground border-border'
                    )}>
                      <FileText className="h-3 w-3" />
                      {clientDeals.length} {clientDeals.length === 1 ? 'deal' : 'deals'}
                    </span>
                    {clientLeads.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-bold bg-muted text-muted-foreground border border-border">
                        <Users className="h-3 w-3" />
                        {clientLeads.length} {clientLeads.length === 1 ? 'lead' : 'leads'}
                      </span>
                    )}
                  </div>

                  {/* Tags */}
                  {client.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {client.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0.5">{tag}</Badge>
                      ))}
                      {client.tags.length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-2 py-0.5">+{client.tags.length - 3}</Badge>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t border-border/50">
                    <Button asChild size="sm" className="flex-1 h-8 text-xs shadow-sm shadow-primary/15">
                      <Link to={`/clients/${client.id}`}>
                        View profile <ChevronRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-destructive hover:bg-destructive/8 hover:text-destructive px-3"
                      onClick={() => setDeleteTargetId(client.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Client</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                <Label htmlFor="company">Company</Label>
                <Input id="company" value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))} placeholder="Optional" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tags">Tags (comma-separated)</Label>
              <Input id="tags" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="investor, repeat-buyer" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Background, preferences, referral details..." rows={3} />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()} className="shadow-sm shadow-primary/20">
                <Plus className="mr-2 h-4 w-4" />
                Add Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open) setDeleteTargetId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to remove{' '}
            <strong className="text-foreground">{deleteTarget?.firstName} {deleteTarget?.lastName}</strong>?
            Their deals and leads will not be deleted.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => deleteTargetId && handleDelete(deleteTargetId)}>
              Remove Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}