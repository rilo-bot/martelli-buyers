import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnquiriesStore } from '@/stores/enquiriesStore';
import { usePermissions } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { CardGridSkeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { Search, Inbox, Mail, ArrowRight, Trash2, Archive, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ContactEnquiry, ContactEnquiryStatus } from '@/types';

const STATUS_OPTIONS: ContactEnquiryStatus[] = ['new', 'reviewed', 'converted', 'archived'];

const STATUS_STYLES: Record<ContactEnquiryStatus, { dot: string; label: string }> = {
  new: { dot: 'bg-emerald-500', label: 'New' },
  reviewed: { dot: 'bg-amber-500', label: 'Reviewed' },
  converted: { dot: 'bg-primary', label: 'Converted' },
  archived: { dot: 'bg-muted-foreground', label: 'Archived' },
};

function formatDate(iso: string): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function EnquiriesPage() {
  const enquiries = useEnquiriesStore((s) => s.enquiries);
  const loaded = useEnquiriesStore((s) => s.loaded);
  const setStatus = useEnquiriesStore((s) => s.setStatus);
  const deleteEnquiry = useEnquiriesStore((s) => s.deleteEnquiry);
  const convert = useEnquiriesStore((s) => s.convert);
  const { can } = usePermissions();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ContactEnquiryStatus | ''>('');
  const [active, setActive] = useState<ContactEnquiry | null>(null);
  const [converting, setConverting] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 200);
  const sorted = useMemo(
    () => [...enquiries].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [enquiries],
  );
  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return sorted.filter((e) => {
      const matchesSearch = !q || `${e.name} ${e.email} ${e.message}`.toLowerCase().includes(q);
      const matchesStatus = !statusFilter || e.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sorted, debouncedSearch, statusFilter]);

  const handleConvert = async (enquiry: ContactEnquiry) => {
    setConverting(true);
    try {
      const { lead, leadCreated } = await convert(enquiry.id);
      setActive(null);
      toast.success(leadCreated ? 'Enquiry converted to a new lead.' : 'Enquiry already linked to a lead.');
      navigate(`/leads/${lead.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to convert enquiry.');
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async (enquiry: ContactEnquiry) => {
    if (!window.confirm(`Delete the enquiry from ${enquiry.name || enquiry.email}?`)) return;
    try {
      await deleteEnquiry(enquiry.id);
      if (active?.id === enquiry.id) setActive(null);
      toast.success('Enquiry deleted.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete enquiry.');
    }
  };

  const handleArchive = async (enquiry: ContactEnquiry) => {
    try {
      await setStatus(enquiry.id, 'archived');
      toast.success('Enquiry archived.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive enquiry.');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Pipeline"
        title="Enquiries"
        subtitle="Incoming website contact submissions. Review and convert the worthwhile ones into leads."
      />

      {/* Status filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setStatusFilter('')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
            !statusFilter ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted text-muted-foreground',
          )}
        >
          All ({enquiries.length})
        </button>
        {STATUS_OPTIONS.map((status) => {
          const count = enquiries.filter((e) => e.status === status).length;
          return (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(statusFilter === status ? '' : status)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border',
                statusFilter === status ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted text-muted-foreground',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLES[status].dot)} />
              {STATUS_STYLES[status].label} ({count})
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search enquiries..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {/* Content */}
      {!loaded ? (
        <CardGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={statusFilter ? `No ${STATUS_STYLES[statusFilter].label.toLowerCase()} enquiries` : 'No enquiries yet'}
          description={
            statusFilter
              ? 'Try a different filter or clear your selection.'
              : 'Submissions from the website contact form will appear here for review.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3 hidden md:table-cell">Enquiry</th>
                <th className="px-4 py-3 hidden lg:table-cell">Received</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setActive(e)}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{e.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {(() => {
                      // The default form has no "enquiry type"; fall back to the first
                      // extra answer (e.g. "How did you hear about us?"), then the message.
                      const summary = e.enquiryType || Object.values(e.extraFields ?? {})[0] || '';
                      return summary ? (
                        <>
                          <div className="text-foreground line-clamp-1 max-w-xs">{summary}</div>
                          {e.message && (
                            <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">{e.message}</div>
                          )}
                        </>
                      ) : (
                        <div className="text-foreground line-clamp-1 max-w-xs">{e.message || '—'}</div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-muted-foreground">{formatDate(e.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLES[e.status].dot)} />
                      {STATUS_STYLES[e.status].label}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={(ev) => ev.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {e.status !== 'converted' && can('leads:create') && (
                        <Button size="sm" variant="outline" className="h-8" loading={converting} onClick={() => handleConvert(e)}>
                          <ArrowRight className="mr-1.5 h-3.5 w-3.5" /> Convert
                        </Button>
                      )}
                      {can('enquiries:delete') && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(e)}
                          aria-label="Delete enquiry"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!active} onOpenChange={(o) => { if (!o) setActive(null); }}>
        <DialogContent className="max-w-lg">
          {active && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-primary" /> {active.name || active.email}
                </DialogTitle>
              </DialogHeader>
              <div className="mt-2 space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Email" value={active.email} />
                  {active.phone && <Field label="Phone" value={active.phone} icon={Phone} />}
                  {active.enquiryType && <Field label="Enquiry type" value={active.enquiryType} />}
                  {active.budget && <Field label="Budget" value={active.budget} />}
                  {active.location && <Field label="Location" value={active.location} />}
                  <Field label="Received" value={formatDate(active.createdAt)} />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Message</p>
                  <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-3 text-foreground">{active.message || '—'}</p>
                </div>
                {active.extraFields && Object.keys(active.extraFields).length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {Object.entries(active.extraFields).map(([label, value]) => (
                      <Field key={label} label={label} value={value || '—'} />
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs">
                  <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLES[active.status].dot)} />
                  <span className="font-medium">{STATUS_STYLES[active.status].label}</span>
                  {active.status === 'converted' && active.convertedLeadId && (
                    <button
                      type="button"
                      className="ml-2 text-primary underline-offset-4 hover:underline"
                      onClick={() => { navigate(`/leads/${active.convertedLeadId}`); setActive(null); }}
                    >
                      View lead
                    </button>
                  )}
                </div>
              </div>
              <DialogFooter className="mt-4">
                {active.status !== 'archived' && active.status !== 'converted' && can('enquiries:edit') && (
                  <Button variant="ghost" onClick={() => handleArchive(active)}>
                    <Archive className="mr-1.5 h-4 w-4" /> Archive
                  </Button>
                )}
                {active.status !== 'converted' && can('leads:create') && (
                  <Button loading={converting} onClick={() => handleConvert(active)}>
                    <ArrowRight className="mr-1.5 h-4 w-4" /> Convert to Lead
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, value, icon: Icon }: { label: string; value: string; icon?: React.ElementType }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className="flex items-center gap-1.5 text-foreground break-words">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        {value}
      </p>
    </div>
  );
}
