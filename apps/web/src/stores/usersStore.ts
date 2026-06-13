import { create } from 'zustand';
import { request } from '@/lib/api';
import type { User } from '@/types';

interface UsersState {
  users: User[];
  loaded: boolean;
  fetch: () => Promise<void>;
  nameFor: (id: string) => string;
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: [],
  loaded: false,
  fetch: async () => {
    const users = await request<User[]>('GET', '/api/users');
    set({ users, loaded: true });
  },
  nameFor: (id) => {
    const u = get().users.find((x) => x.id === id);
    return u ? u.name || u.email : '';
  },
}));
