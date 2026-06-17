import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { useClientsStore } from '@/stores/clientsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useAuthStore } from '@/stores/authStore';
import { useEmailMessagesStore } from '@/stores/emailMessagesStore';
import type { EmailMessage } from '@/types';

interface Props {
  email: EmailMessage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Tag a synced email to a client and (optionally) one of that client's deals. */
export function LinkEmailDialog({ email, open, onOpenChange }: Props) {
  const clients = useClientsStore((s) => s.clients);
  const deals = useDealsStore((s) => s.deals);
  const currentUser = useAuthStore((s) => s.currentUser);
  const link = useEmailMessagesStore((s) => s.link);

  const [clientId, setClientId] = useState('');
  const [dealId, setDealId] = useState('');
  const [saving, setSaving] = useState(false);

  // Seed the form from the email's existing link whenever the dialog opens.
  useEffect(() => {
    if (open && email) {
      setClientId(email.clientId);
      setDealId(email.dealId);
    }
  }, [open, email]);

  // Deals selectable for the chosen client (plus any already-linked deal).
  const clientDeals = useMemo(
    () => deals.filter((d) => d.clientId === clientId || d.id === dealId),
    [deals, clientId, dealId],
  );

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)),
    [clients],
  );

  const handleSave = async () => {
    if (!email) return;
    if (!clientId && !dealId) {
      toast.error('Pick a client or a deal to link this email to.');
      return;
    }
    setSaving(true);
    try {
      await link(email.id, { clientId, dealId, linkedBy: currentUser?.id });
      toast.success('Email linked.');
      onOpenChange(false);
    } catch {
      toast.error('Could not link the email.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Link email to a case</DialogTitle>
          <DialogDescription className="truncate">
            {email?.subject || '(no subject)'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="linkClient">Client</Label>
            <Select
              id="linkClient"
              value={clientId}
              onChange={(e) => { setClientId(e.target.value); setDealId(''); }}
            >
              <option value="">— None —</option>
              {sortedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.firstName} {c.lastName}{c.email ? ` · ${c.email}` : ''}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="linkDeal">Buyer Journey (deal)</Label>
            <Select
              id="linkDeal"
              value={dealId}
              onChange={(e) => setDealId(e.target.value)}
              disabled={clientDeals.length === 0}
            >
              <option value="">{clientDeals.length === 0 ? '— No deals for this client —' : '— None —'}</option>
              {clientDeals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.clientName || 'Deal'} · {d.stage}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              Linking to a deal adds the email to that Buyer Journey’s timeline.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Linking…' : 'Link email'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
