import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { OffMarketProperty } from '@/types';

const api = resource<OffMarketProperty>('off-market');

interface OffMarketState {
  properties: OffMarketProperty[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addProperty: (property: Omit<OffMarketProperty, 'id' | 'createdAt' | 'updatedAt'>) => Promise<OffMarketProperty>;
  updateProperty: (id: string, updates: Partial<OffMarketProperty>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  linkToDeal: (propertyId: string, dealId: string) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
}

export const useOffMarketStore = create<OffMarketState>()((set, get) => ({
  properties: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const properties = await api.list();
      set({ properties, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addProperty: async (data) => {
    const property = await api.create(data);
    set((s) => ({ properties: [...s.properties, property] }));
    return property;
  },

  updateProperty: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ properties: s.properties.map((p) => (p.id === id ? updated : p)) }));
  },

  deleteProperty: async (id) => {
    await api.remove(id);
    set((s) => ({ properties: s.properties.filter((p) => p.id !== id) }));
  },

  linkToDeal: (propertyId, dealId) => {
    const prop = get().properties.find((p) => p.id === propertyId);
    if (!prop || prop.usedInDealIds.includes(dealId)) return Promise.resolve();
    return get().updateProperty(propertyId, { usedInDealIds: [...prop.usedInDealIds, dealId] });
  },

  toggleActive: (id) => {
    const prop = get().properties.find((p) => p.id === id);
    if (!prop) return Promise.resolve();
    return get().updateProperty(id, { isActive: !prop.isActive });
  },
}));
