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
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Stagger, StaggerItem, CountUp } from '@/components/motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Plus, Search, Users, Phone, Mail, Building2, FileText, ChevronRight, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { Client } from '@/types';

const EMPTY_FORM = {
  firstName: '', lastName: '', email: '', phone: '', company: '', notes: '', tags: '',
};

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
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

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

  const canSubmit = !!form.firstName.trim() && !!form.lastName.trim() && !!form.email.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!canSubmit) {
      toast.error('First name, last name and email are required.');
      return;
    }
    setSubmitting(true);
    try {
      await addClient({
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
        xeroContactId: '',
        xeroSyncedAt: '',
      });
      setForm(EMPTY_FORM);
      setShowAddDialog(false);
      toast.success('Client added.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add client.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteClient(id);
      setDeleteTargetId(null);
      toast.success('Client removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove client.');
    } finally {
      setDeleting(false);
    }
  };

  const deleteTarget = deleteTargetId ? clients.find((c) => c.id === deleteTargetId) : null;

  const statCards = [
    { label: 'Total Clients', value: stats.total },
    { label: 'Active Deals', value: stats.active },
    { label: 'Completed', value: stats.completed },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        subtitle="All buyer clients, linked to their leads and active deals."
        actions={
          <Button onClick={() => setShowAddDialog(true)} className="h-9 shadow-sm shadow-primary/20">
            <Plus className="mr-2 h-4 w-4" /> Add Client
          </Button>
        }
      />

      {/* Stats strip */}
      <Stagger className="grid grid-cols-3 gap-3">
        {statCards.map((s) => (
          <StaggerItem key={s.label}>
            <Card className="border-border/70 kpi-card">
              <CardContent className="px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
                <CountUp value={s.value} className="mt-1 block text-2xl font-bold tabular-nums text-foreground" />
              </CardContent>
            </Card>
          </StaggerItem>
        ))}
      </Stagger>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email or company..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-9"
        />
      </div>

      {/* Client grid */}
      {filteredClients.length === 0 ? (
        <EmptyState
          icon={Users}
          title={search ? 'No clients match your search' : 'No clients yet'}
          description={
            search
              ? 'Try a different name, email or company.'
              : 'Clients are created automatically when you mark a lead as Won, or add one manually.'
          }
          action={!search && (
            <Button onClick={() => setShowAddDialog(true)} className="shadow-sm shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" /> Add your first client
            </Button>
          )}
        />
      ) : (
        <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" step={0.04}>
          {filteredClients.map((client) => {
            const clientDeals = getClientDeals(client);
            const clientLeads = getClientLeads(client);
            const activeDeals = clientDeals.filter((d) => d.stage !== 'complete');
            const initials = `${client.firstName[0] ?? ''}${client.lastName[0] ?? ''}`.toUpperCase();

            return (
              <StaggerItem key={client.id}>
                <Card className="group h-full border-border/70 bg-card card-interactive">
                  <CardHeader className="px-5 pb-3 pt-5">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-bold text-primary">
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="truncate text-[15px] font-bold transition-colors group-hover:text-primary">
                          {client.firstName} {client.lastName}
                        </CardTitle>
                        {client.company && (
                          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
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
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold',
                        activeDeals.length > 0
                          ? 'border-primary/20 bg-primary/8 text-primary'
                          : 'border-border bg-muted text-muted-foreground',
                      )}>
                        <FileText className="h-3 w-3" />
                        {clientDeals.length} {clientDeals.length === 1 ? 'deal' : 'deals'}
                      </span>
                      {clientLeads.length > 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
                          <Users className="h-3 w-3" />
                          {clientLeads.length} {clientLeads.length === 1 ? 'lead' : 'leads'}
                        </span>
                      )}
                    </div>

                    {/* Tags */}
                    {client.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {client.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="px-2 py-0.5 text-[10px]">{tag}</Badge>
                        ))}
                        {client.tags.length > 3 && (
                          <Badge variant="secondary" className="px-2 py-0.5 text-[10px]">+{client.tags.length - 3}</Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2 border-t border-border/50 pt-2">
                      <Button asChild size="sm" className="h-8 flex-1 text-xs shadow-sm shadow-primary/15">
                        <Link to={`/clients/${client.id}`}>
                          View profile <ChevronRight className="ml-1 h-3 w-3" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-3 text-xs text-destructive hover:bg-destructive/8 hover:text-destructive"
                        onClick={() => setDeleteTargetId(client.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      {/* Add Client Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(o) => { if (!submitting) setShowAddDialog(o); }}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
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
                <Button type="button" variant="ghost" disabled={submitting}>Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={!canSubmit || submitting} className="shadow-sm shadow-primary/20">
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Adding…</>
                ) : (
                  <><Plus className="mr-2 h-4 w-4" /> Add Client</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTargetId} onOpenChange={(open) => { if (!open && !deleting) setDeleteTargetId(null); }}>
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
              <Button variant="ghost" disabled={deleting}>Cancel</Button>
            </DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={() => deleteTargetId && handleDelete(deleteTargetId)}>
              {deleting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing…</>
              ) : (
                'Remove Client'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
