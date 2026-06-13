import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Offer } from '@/types';

const api = resource<Offer>('offers');

interface OffersState {
  offers: Offer[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addOffer: (offer: Omit<Offer, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Offer>;
  updateOffer: (id: string, updates: Partial<Offer>) => Promise<void>;
  deleteOffer: (id: string) => Promise<void>;
  getOffersForDeal: (dealId: string) => Offer[];
}

export const useOffersStore = create<OffersState>()((set, get) => ({
  offers: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const offers = await api.list();
      set({ offers, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addOffer: async (data) => {
    const offer = await api.create(data);
    set((s) => ({ offers: [...s.offers, offer] }));
    return offer;
  },

  updateOffer: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ offers: s.offers.map((o) => (o.id === id ? updated : o)) }));
  },

  deleteOffer: async (id) => {
    await api.remove(id);
    set((s) => ({ offers: s.offers.filter((o) => o.id !== id) }));
  },

  getOffersForDeal: (dealId) => get().offers.filter((o) => o.dealId === dealId),
}));
