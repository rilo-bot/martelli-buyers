import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plug, CheckCircle, AlertCircle, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useXeroStore } from '@/stores/xeroStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { xeroConnectUrl, disconnectXero, runXeroImport } from '@/lib/xero';

export function XeroIntegrationCard() {
  const {
    configured, connected, tenantName, connectedByEmail, expiresAt, loaded, fetchStatus,
    importStatus, importedClients, linkedInvoices,
  } = useXeroStore();
  const [disconnecting, setDisconnecting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [params, setParams] = useSearchParams();

  const refreshImportedData = () => {
    void useClientsStore.getState().fetch();
    void useInvoicesStore.getState().fetch();
  };

  // Surface the OAuth round-trip result, then clear the query param.
  useEffect(() => {
    const result = params.get('xero');
    if (!result) return;
    if (result === 'connected') {
      toast.success('Xero connected. Importing your contacts…');
      fetchStatus();
      refreshImportedData();
    } else if (result === 'error') {
      toast.error('Could not connect Xero. Please try again.');
    }
    params.delete('xero');
    setParams(params, { replace: true });
  }, [params, setParams, fetchStatus]);

  // While an import is running, poll status so the summary updates, then pull
  // the freshly imported clients/invoices into their stores when it finishes.
  useEffect(() => {
    if (importStatus !== 'running') return;
    const timer = setInterval(async () => {
      await fetchStatus();
      if (useXeroStore.getState().importStatus !== 'running') {
        refreshImportedData();
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [importStatus, fetchStatus]);

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await disconnectXero();
      await fetchStatus();
      toast.success('Xero disconnected.');
    } catch {
      toast.error('Failed to disconnect Xero.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleResync = async () => {
    setImporting(true);
    try {
      await runXeroImport();
      await fetchStatus();
      toast.success('Re-syncing from Xero…');
    } catch {
      toast.error('Could not start the Xero import.');
    } finally {
      setImporting(false);
    }
  };

  const isRunning = importStatus === 'running' || importing;

  return (
    <Card className="border-border/80 shadow-sm">
      <CardHeader className="pb-4 border-b border-border/60">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Plug className="h-4.5 w-4.5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Xero</CardTitle>
              <CardDescription className="mt-1 text-sm leading-relaxed">
                Sync clients and invoices with your Xero organisation, and pull existing contacts on connect.
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
              Xero isn’t configured on the server. Set <code className="font-mono text-xs">XERO_CLIENT_ID</code> and{' '}
              <code className="font-mono text-xs">XERO_CLIENT_SECRET</code> to enable it.
            </p>
          </div>
        ) : connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{tenantName || 'Xero organisation'}</p>
                  <p className="text-xs text-muted-foreground">
                    {connectedByEmail ? `Connected by ${connectedByEmail}` : 'Connected'}
                    {expiresAt && ` · token renews ${new Date(expiresAt).toLocaleDateString('en-NZ')}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleResync} disabled={isRunning}>
                  {isRunning ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Syncing…</>
                  ) : (
                    <><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Re-sync from Xero</>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting}>
                  {disconnecting ? 'Disconnecting…' : 'Disconnect'}
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {isRunning
                ? 'Importing contacts and invoices from Xero…'
                : `Synced · imported ${importedClients} client${importedClients === 1 ? '' : 's'} · linked ${linkedInvoices} invoice${linkedInvoices === 1 ? '' : 's'}. New clients and invoices sync automatically.`}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Connect the agency’s Xero organisation to start syncing invoices.
            </p>
            <Button size="sm" onClick={() => { window.location.href = xeroConnectUrl(); }}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Connect Xero
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
