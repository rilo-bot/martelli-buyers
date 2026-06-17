import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mail, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useOutlookStore } from '@/stores/outlookStore';
import { useEmailMessagesStore } from '@/stores/emailMessagesStore';
import { outlookConnectUrl, disconnectOutlook, runOutlookSync } from '@/lib/outlook';

export function OutlookIntegrationCard() {
  const {
    configured, connected, accountEmail, connectedByEmail, loaded, fetchStatus,
    syncStatus, lastSyncAt, syncedCount, syncError,
  } = useOutlookStore();
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [params, setParams] = useSearchParams();

  const refreshEmails = () => { void useEmailMessagesStore.getState().fetch(); };

  // Surface the OAuth round-trip result, then clear the query param.
  useEffect(() => {
    const result = params.get('outlook');
    if (!result) return;
    if (result === 'connected') {
      toast.success('Outlook connected. Importing your mail…');
      fetchStatus();
      refreshEmails();
    } else if (result === 'error') {
      toast.error('Could not connect Outlook. Please try again.');
    }
    params.delete('outlook');
    setParams(params, { replace: true });
  }, [params, setParams, fetchStatus]);

  // While a sync is running, poll status so the summary updates, then pull the
  // freshly synced emails into their store when it finishes.
  useEffect(() => {
    if (syncStatus !== 'running') return;
    const timer = setInterval(async () => {
      await fetchStatus();
      if (useOutlookStore.getState().syncStatus !== 'running') refreshEmails();
    }, 2500);
    return () => clearInterval(timer);
  }, [syncStatus, fetchStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectOutlook();
      await fetchStatus();
      toast.success('Outlook disconnected.');
    } catch {
      toast.error('Failed to disconnect Outlook.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await runOutlookSync();
      await fetchStatus();
      toast.success('Syncing mail from Outlook…');
    } catch {
      toast.error('Could not start the Outlook sync.');
    } finally {
      setSyncing(false);
    }
  };

  const isRunning = syncStatus === 'running' || syncing;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Mail className="h-[18px] w-[18px]" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Outlook</CardTitle>
              <CardDescription className="mt-1 text-sm leading-relaxed">
                Sync Inbox &amp; Sent mail from your Outlook mailbox into the CRM, auto-linked to matching clients and deals.
              </CardDescription>
            </div>
          </div>
          {loaded && (
            <Badge variant={connected ? 'default' : 'secondary'} className="shrink-0">
              {connected ? 'Connected' : configured ? 'Not connected' : 'Not configured'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {!configured ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-2.5 dark:border-amber-800/40 dark:bg-amber-900/10">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Outlook isn’t configured on the server. Set <code className="font-mono text-xs">MS_CLIENT_ID</code> and{' '}
              <code className="font-mono text-xs">MS_CLIENT_SECRET</code> to enable it.
            </p>
          </div>
        ) : connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{accountEmail || 'Outlook mailbox'}</p>
                  <p className="text-xs text-muted-foreground">
                    {connectedByEmail ? `Connected by ${connectedByEmail}` : 'Connected'}
                    {lastSyncAt && ` · last synced ${new Date(lastSyncAt).toLocaleString('en-NZ')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSync} disabled={isRunning}>
                  {isRunning ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Syncing…</>
                  ) : (
                    <><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Sync now</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {syncStatus === 'error'
                ? `Last sync failed: ${syncError || 'unknown error'}`
                : isRunning
                  ? 'Pulling Inbox and Sent mail from Outlook…'
                  : `Synced ${syncedCount} email${syncedCount === 1 ? '' : 's'}. New mail syncs automatically and auto-links to matching clients/deals.`}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Connect the agency’s Outlook mailbox to start syncing email into the CRM.
            </p>
            <Button size="sm" onClick={() => { window.location.href = outlookConnectUrl(); }}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Connect Outlook
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
