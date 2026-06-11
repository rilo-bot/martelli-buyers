import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Deal, DealStage } from '@/types';

const api = resource<Deal>('deals');

interface DealsState {
  deals: Deal[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addDeal: (deal: Omit<Deal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Deal>;
  updateDeal: (id: string, updates: Partial<Deal>) => Promise<void>;
  deleteDeal: (id: string) => Promise<void>;
  updateDealStage: (id: string, stage: DealStage) => Promise<void>;
  addInvoiceToDeal: (dealId: string, invoiceId: string) => Promise<void>;
}

export const useDealsStore = create<DealsState>()((set, get) => ({
  deals: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const deals = await api.list();
      set({ deals, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addDeal: async (dealData) => {
    const deal = await api.create(dealData);
    set((s) => ({ deals: [...s.deals, deal] }));
    return deal;
  },

  updateDeal: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ deals: s.deals.map((d) => (d.id === id ? updated : d)) }));
  },

  deleteDeal: async (id) => {
    await api.remove(id);
    set((s) => ({ deals: s.deals.filter((d) => d.id !== id) }));
  },

  updateDealStage: (id, stage) => get().updateDeal(id, { stage }),

  addInvoiceToDeal: (dealId, invoiceId) => {
    const deal = get().deals.find((d) => d.id === dealId);
    if (!deal) return Promise.resolve();
    if ((deal.invoiceIds ?? []).includes(invoiceId)) return Promise.resolve();
    return get().updateDeal(dealId, { invoiceIds: [...(deal.invoiceIds ?? []), invoiceId] });
  },
}));
