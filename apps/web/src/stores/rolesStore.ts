import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Role } from '@/types';

const api = resource<Role>('roles');

interface RolesState {
  roles: Role[];
  loaded: boolean;
  fetch: () => Promise<void>;
  create: (data: Partial<Role>) => Promise<Role>;
  update: (id: string, data: Partial<Role>) => Promise<Role>;
  remove: (id: string) => Promise<void>;
  /** Resolve a role key to its display name (falls back to the key). */
  nameFor: (key: string) => string;
}

export const useRolesStore = create<RolesState>()((set, get) => ({
  roles: [],
  loaded: false,
  fetch: async () => {
    const roles = await api.list();
    set({ roles, loaded: true });
  },
  create: async (data) => {
    const role = await api.create(data);
    set((s) => ({ roles: [...s.roles, role] }));
    return role;
  },
  update: async (id, data) => {
    const role = await api.update(id, data);
    set((s) => ({ roles: s.roles.map((r) => (r.id === id ? role : r)) }));
    return role;
  },
  remove: async (id) => {
    await api.remove(id);
    set((s) => ({ roles: s.roles.filter((r) => r.id !== id) }));
  },
  nameFor: (key) => {
    const r = get().roles.find((x) => x.key === key);
    return r ? r.name || r.key : key;
  },
}));
