import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Property, PropertyStatus } from '@/types';

const api = resource<Property>('properties');

interface PropertiesState {
  properties: Property[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addProperty: (property: Omit<Property, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Property>;
  updateProperty: (id: string, updates: Partial<Property>) => Promise<void>;
  deleteProperty: (id: string) => Promise<void>;
  updatePropertyStatus: (id: string, status: PropertyStatus) => Promise<void>;
  getPropertiesForDeal: (dealId: string) => Property[];
}

export const usePropertiesStore = create<PropertiesState>()((set, get) => ({
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

  updatePropertyStatus: (id, status) => get().updateProperty(id, { status }),

  getPropertiesForDeal: (dealId) => get().properties.filter((p) => p.dealId === dealId),
}));
