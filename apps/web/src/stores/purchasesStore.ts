import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Purchase } from '@/types';

const api = resource<Purchase>('purchases');

interface PurchasesState {
  purchases: Purchase[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addPurchase: (purchase: Omit<Purchase, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Purchase>;
  updatePurchase: (id: string, updates: Partial<Purchase>) => Promise<void>;
  deletePurchase: (id: string) => Promise<void>;
  getPurchaseForDeal: (dealId: string) => Purchase | undefined;
}

export const usePurchasesStore = create<PurchasesState>()((set, get) => ({
  purchases: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const purchases = await api.list();
      set({ purchases, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addPurchase: async (data) => {
    const purchase = await api.create(data);
    set((s) => ({ purchases: [...s.purchases, purchase] }));
    return purchase;
  },

  updatePurchase: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ purchases: s.purchases.map((p) => (p.id === id ? updated : p)) }));
  },

  deletePurchase: async (id) => {
    await api.remove(id);
    set((s) => ({ purchases: s.purchases.filter((p) => p.id !== id) }));
  },

  // A journey has at most one final purchase.
  getPurchaseForDeal: (dealId) => get().purchases.find((p) => p.dealId === dealId),
}));
