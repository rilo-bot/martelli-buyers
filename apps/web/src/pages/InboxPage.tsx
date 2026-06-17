import { useMemo, useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, RefreshCw, Loader2, Inbox as InboxIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { EmailList } from '@/components/EmailList';
import { LinkEmailDialog } from '@/components/LinkEmailDialog';
import { useEmailMessagesStore } from '@/stores/emailMessagesStore';
import { useOutlookStore } from '@/stores/outlookStore';
import { runOutlookSync } from '@/lib/outlook';
import type { EmailMessage } from '@/types';

type Filter = 'all' | 'unlinked' | 'linked';

export default function InboxPage() {
  const { emails, loading, unlink } = useEmailMessagesStore();
  const { configured, connected, syncStatus } = useOutlookStore();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [linkTarget, setLinkTarget] = useState<EmailMessage | null>(null);
  const [syncing, setSyncing] = useState(false);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return emails.filter((e) => {
      if (filter === 'unlinked' && (e.clientId || e.dealId)) return false;
      if (filter === 'linked' && !(e.clientId || e.dealId)) return false;
      if (!q) return true;
      return (
        e.subject.toLowerCase().includes(q) ||
        e.fromAddress.toLowerCase().includes(q) ||
        e.fromName.toLowerCase().includes(q) ||
        e.bodyPreview.toLowerCase().includes(q)
      );
    });
  }, [emails, filter, search]);

  const unlinkedCount = useMemo(() => emails.filter((e) => !e.clientId && !e.dealId).length, [emails]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await runOutlookSync();
      await useOutlookStore.getState().fetchStatus();
      // Give the background sync a moment, then refresh the list.
      setTimeout(() => { void useEmailMessagesStore.getState().fetch(); }, 3000);
      toast.success('Syncing mail from Outlook…');
    } catch {
      toast.error('Could not start the sync. Is Outlook connected in Settings?');
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async (email: EmailMessage) => {
    try {
      await unlink(email.id);
      toast.success('Email unlinked.');
    } catch {
      toast.error('Could not unlink the email.');
    }
  };

  const isRunning = syncStatus === 'running' || syncing;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Communications"
        title="Email Inbox"
        subtitle="Outlook mail synced into the CRM. Link emails to a client or deal to keep every conversation on the case."
        actions={
          <Button size="sm" onClick={handleSync} disabled={isRunning || !connected}>
            {isRunning
              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Syncing…</>
              : <><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Sync now</>}
          </Button>
        }
      />

      {!configured ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 dark:border-amber-800/40 dark:bg-amber-900/10">
          <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Outlook isn’t configured on the server yet. Once an administrator connects it in Settings, synced mail appears here.
          </p>
        </div>
      ) : !connected ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/8 border-2 border-dashed border-primary/30 mb-4">
            <InboxIcon className="h-8 w-8 text-primary/40" />
          </div>
          <h3 className="text-base font-semibold">Outlook not connected</h3>
          <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
            Connect the agency’s Outlook mailbox from Settings → Integrations to start syncing email into the CRM.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList>
                <TabsTrigger value="all">All ({emails.length})</TabsTrigger>
                <TabsTrigger value="unlinked">Needs linking ({unlinkedCount})</TabsTrigger>
                <TabsTrigger value="linked">Linked ({emails.length - unlinkedCount})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subject, sender, body…"
                className="pl-9"
              />
            </div>
          </div>

          {loading && emails.length === 0
            ? <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
            : (
              <EmailList
                emails={visible}
                showLinkAction
                onLink={(e) => setLinkTarget(e)}
                onUnlink={handleUnlink}
                emptyText={filter === 'unlinked'
                  ? 'No emails are waiting to be linked. New unmatched mail shows up here.'
                  : 'No emails match this view yet.'}
              />
            )}
        </>
      )}

      <LinkEmailDialog
        email={linkTarget}
        open={Boolean(linkTarget)}
        onOpenChange={(o) => { if (!o) setLinkTarget(null); }}
      />
    </div>
  );
}
