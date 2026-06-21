import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Eye, Mail, Bell, ExternalLink, ArrowRight, Receipt, Loader2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useConfigStore } from '@/stores/configStore';
import { useXeroStore } from '@/stores/xeroStore';
import { useAuthStore } from '@/stores/authStore';
import { usePermissions } from '@/lib/permissions';
import { downloadInvoicePdf, invoicePdfPreviewPath } from '@/lib/documents';
import { DocumentViewer } from '@/components/DocumentViewer';
import { canDownloadDoc } from '@/lib/docAccess';
import { pushInvoiceToXero } from '@/lib/xero';
import type { Invoice, InvoiceStatus } from '@/types';

const money = (n: number) => `$${(n || 0).toLocaleString()}`;

type DisplayStatus = InvoiceStatus; // overdue is computed below

const STATUS_BADGE: Record<DisplayStatus, string> = {
  draft: 'bg-muted text-muted-foreground border-border',
  sent: 'bg-primary/10 text-primary border-primary/20',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800/40',
  overdue: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800/40',
};

const FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'paid', label: 'Paid' },
];

const isOverdue = (inv: Invoice) =>
  inv.status === 'overdue' || (inv.status === 'sent' && !!inv.dueDate && new Date(inv.dueDate).getTime() < Date.now());

const displayStatus = (inv: Invoice): DisplayStatus => (isOverdue(inv) ? 'overdue' : inv.status);

export default function InvoicesPage() {
  const invoices = useInvoicesStore((s) => s.invoices);
  const loaded = useInvoicesStore((s) => s.loaded);
  const emailInvoice = useInvoicesStore((s) => s.emailInvoice);
  const remindInvoice = useInvoicesStore((s) => s.remindInvoice);
  const replaceInvoice = useInvoicesStore((s) => s.replaceInvoice);
  const deals = useDealsStore((s) => s.deals);
  const hasEmail = useConfigStore((s) => s.hasEmail);
  const hasXero = useConfigStore((s) => s.hasXero);
  const xeroConnected = useXeroStore((s) => s.connected);
  const currentUser = useAuthStore((s) => s.currentUser);
  const { can } = usePermissions();
  const canSend = can('invoices:send');

  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [xeroBusyId, setXeroBusyId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const invoiceOwner = (inv: Invoice) => deals.find((d) => d.id === inv.dealId)?.assignedTo || '';

  const clientName = (dealId: string) => deals.find((d) => d.id === dealId)?.clientName || '—';

  const totals = useMemo(() => {
    let outstanding = 0, overdue = 0, paid = 0;
    for (const inv of invoices) {
      const st = displayStatus(inv);
      if (st === 'paid') paid += inv.total;
      else if (st === 'overdue') { overdue += inv.total; outstanding += inv.total; }
      else if (st === 'sent') outstanding += inv.total;
    }
    return { outstanding, overdue, paid };
  }, [invoices]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices
      .filter((inv) => (filter === 'all' ? true : displayStatus(inv) === filter))
      .filter((inv) => !q || inv.invoiceNumber.toLowerCase().includes(q) || clientName(inv.dealId).toLowerCase().includes(q))
      .slice()
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, filter, search, deals]);

  const handleDownload = async (inv: Invoice) => {
    try {
      await downloadInvoicePdf(inv.id, inv.invoiceNumber);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to download invoice.');
    }
  };

  const handleEmailOrRemind = async (inv: Invoice) => {
    setBusyId(inv.id);
    const reminder = displayStatus(inv) === 'sent' || displayStatus(inv) === 'overdue';
    try {
      if (reminder) {
        await remindInvoice(inv.id);
        toast.success('Reminder sent to the client.');
      } else {
        await emailInvoice(inv.id);
        toast.success('Invoice emailed to the client.');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email.');
    } finally {
      setBusyId(null);
    }
  };

  const handlePushXero = async (inv: Invoice) => {
    setXeroBusyId(inv.id);
    try {
      replaceInvoice(await pushInvoiceToXero(inv.id));
      toast.success('Invoice sent to Xero.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send to Xero.');
    } finally {
      setXeroBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" subtitle="Every invoice across all buyer journeys." />

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-border/60"><CardContent className="pt-4 pb-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Outstanding</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{money(totals.outstanding)}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Overdue</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-rose-600 dark:text-rose-400">{money(totals.overdue)}</p>
        </CardContent></Card>
        <Card className="border-border/60"><CardContent className="pt-4 pb-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">Paid</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-emerald-600 dark:text-emerald-400">{money(totals.paid)}</p>
        </CardContent></Card>
      </div>

      {/* Filters + search */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" onClick={() => setFilter(f.value)}
              className={cn('h-8 px-3 text-xs rounded-lg border transition-colors',
                filter === f.value ? 'border-primary/50 bg-primary/10 text-primary font-semibold' : 'border-border/60 hover:bg-muted/50')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search invoice # or client…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      {/* Table */}
      {!loaded ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading…</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/8 border border-dashed border-primary/30 mb-3">
            <Receipt className="h-6 w-6 text-primary/40" />
          </div>
          <p className="text-sm font-medium">{invoices.length === 0 ? 'No invoices yet' : 'No invoices match your filters'}</p>
          <p className="text-xs text-muted-foreground mt-1">Invoices are created from a buyer journey’s Invoices tab.</p>
        </CardContent></Card>
      ) : (
        <Card className="border-border/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Invoice</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Client</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Due</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filtered.map((inv) => {
                  const st = displayStatus(inv);
                  const overdue = st === 'overdue';
                  return (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{inv.invoiceNumber || '—'}</td>
                      <td className="px-4 py-3">
                        <Link to={`/journeys/${inv.dealId}`} className="text-primary hover:underline">{clientName(inv.dealId)}</Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-semibold">{money(inv.total)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border capitalize', STATUS_BADGE[st])}>{st}</span>
                      </td>
                      <td className={cn('px-4 py-3', overdue ? 'text-rose-600 dark:text-rose-400 font-medium' : 'text-muted-foreground')}>{inv.dueDate || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Preview invoice" onClick={() => setViewInvoice(inv)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {hasEmail && canSend && inv.status !== 'paid' && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title={st === 'draft' ? 'Email invoice' : 'Send reminder'}
                              disabled={busyId === inv.id} onClick={() => handleEmailOrRemind(inv)}>
                              {busyId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : st === 'draft' ? <Mail className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {canSend && hasXero && !inv.xeroInvoiceId && (
                            xeroConnected ? (
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="Send to Xero"
                                disabled={xeroBusyId === inv.id} onClick={() => handlePushXero(inv)}>
                                {xeroBusyId === inv.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              </Button>
                            ) : (
                              <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Connect Xero in Settings to send">
                                <Link to="/settings?section=integrations"><Send className="h-3.5 w-3.5 opacity-50" /></Link>
                              </Button>
                            )
                          )}
                          {inv.xeroUrl && (
                            <a href={inv.xeroUrl} target="_blank" rel="noreferrer" title="View in Xero"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          <Button asChild variant="ghost" size="icon" className="h-7 w-7" title="Open journey">
                            <Link to={`/journeys/${inv.dealId}`}><ArrowRight className="h-3.5 w-3.5" /></Link>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {viewInvoice && (
        <DocumentViewer
          open={!!viewInvoice}
          onClose={() => setViewInvoice(null)}
          title={`Invoice ${viewInvoice.invoiceNumber || ''}`.trim()}
          mimeType="application/pdf"
          previewPath={invoicePdfPreviewPath(viewInvoice.id)}
          canDownload={canDownloadDoc(invoiceOwner(viewInvoice), currentUser)}
          onDownload={() => handleDownload(viewInvoice)}
        />
      )}
    </div>
  );
}
