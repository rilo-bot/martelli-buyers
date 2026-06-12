import { useCallback } from 'react';
import { request } from '@/lib/api';
import { useDealsStore } from '@/stores/dealsStore';
import { useClientsStore } from '@/stores/clientsStore';
import { useLeadsStore } from '@/stores/leadsStore';
import type { Client, Deal, Lead } from '@/types';
import type { WonFormState } from './LeadDialogs';

export interface WonResult {
  lead: Lead;
  deal: Deal;
  client: Client;
  /** True when a brand-new client profile was created (vs. linking to an existing one). */
  clientCreated: boolean;
}

/**
 * Convert a won lead into a client + deal via the server's atomic `/win`
 * endpoint, then sync the three affected stores from the authoritative result.
 *
 * The server handles ordering, email de-duplication, and rollback of a
 * just-created client if the deal can't be created — so the whole conversion
 * either fully succeeds or throws, and the caller can surface a real error
 * instead of a "success toast on a half-finished conversion".
 */
export function useWonConversion() {
  return useCallback(async (lead: Lead, won: WonFormState): Promise<WonResult> => {
    if (won.clientMode === 'existing' && !won.existingClientId) {
      throw new Error('Please choose an existing client to link.');
    }

    const result = await request<WonResult>('POST', `/api/leads/${lead.id}/win`, {
      clientMode: won.clientMode,
      existingClientId: won.clientMode === 'existing' ? won.existingClientId : '',
    });

    // Mirror the server's authoritative records into the local stores.
    useLeadsStore.setState((s) => ({
      leads: s.leads.map((l) => (l.id === result.lead.id ? result.lead : l)),
    }));
    useDealsStore.setState((s) => ({
      deals: s.deals.some((d) => d.id === result.deal.id)
        ? s.deals.map((d) => (d.id === result.deal.id ? result.deal : d))
        : [...s.deals, result.deal],
    }));
    useClientsStore.setState((s) => ({
      clients: s.clients.some((c) => c.id === result.client.id)
        ? s.clients.map((c) => (c.id === result.client.id ? result.client : c))
        : [...s.clients, result.client],
    }));

    return result;
  }, []);
}
