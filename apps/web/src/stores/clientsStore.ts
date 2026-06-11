import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Client } from '@/types';

const api = resource<Client>('clients');

interface ClientsState {
  clients: Client[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Client>;
  updateClient: (id: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  addDealToClient: (clientId: string, dealId: string) => Promise<void>;
  addLeadToClient: (clientId: string, leadId: string) => Promise<void>;
  findClientByEmail: (email: string) => Client | undefined;
}

export const useClientsStore = create<ClientsState>()((set, get) => ({
  clients: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const clients = await api.list();
      set({ clients, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addClient: async (clientData) => {
    const client = await api.create(clientData);
    set((s) => ({ clients: [...s.clients, client] }));
    return client;
  },

  updateClient: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? updated : c)) }));
  },

  deleteClient: async (id) => {
    await api.remove(id);
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }));
  },

  addDealToClient: (clientId, dealId) => {
    const client = get().clients.find((c) => c.id === clientId);
    if (!client || client.dealIds.includes(dealId)) return Promise.resolve();
    return get().updateClient(clientId, { dealIds: [...client.dealIds, dealId] });
  },

  addLeadToClient: (clientId, leadId) => {
    const client = get().clients.find((c) => c.id === clientId);
    if (!client || client.leadIds.includes(leadId)) return Promise.resolve();
    return get().updateClient(clientId, { leadIds: [...client.leadIds, leadId] });
  },

  findClientByEmail: (email) =>
    get().clients.find((c) => c.email.toLowerCase() === email.toLowerCase()),
}));
