import { create } from 'zustand';
import { request } from '@/lib/api';
import type { User } from '@/types';

interface InviteResult { user: User; inviteUrl: string }

interface UsersState {
  users: User[];
  loaded: boolean;
  fetch: () => Promise<void>;
  /** Invite a new user. Returns the invite link so the caller can copy/share it. */
  create: (data: { email: string; name?: string; role: string }) => Promise<InviteResult>;
  /** Regenerate + resend an invite. Returns the fresh invite link. */
  resendInvite: (id: string) => Promise<string>;
  update: (id: string, data: Partial<Pick<User, 'name' | 'role'>>) => Promise<User>;
  remove: (id: string) => Promise<void>;
  nameFor: (id: string) => string;
}

export const useUsersStore = create<UsersState>()((set, get) => ({
  users: [],
  loaded: false,
  fetch: async () => {
    const users = await request<User[]>('GET', '/api/users');
    set({ users, loaded: true });
  },
  create: async (data) => {
    const res = await request<InviteResult>('POST', '/api/users', data);
    set((s) => ({ users: [...s.users, res.user] }));
    return res;
  },
  resendInvite: async (id) => {
    const res = await request<InviteResult>('POST', `/api/users/${id}/invite`, {});
    set((s) => ({ users: s.users.map((u) => (u.id === id ? res.user : u)) }));
    return res.inviteUrl;
  },
  update: async (id, data) => {
    const user = await request<User>('PATCH', `/api/users/${id}`, data);
    set((s) => ({ users: s.users.map((u) => (u.id === id ? user : u)) }));
    return user;
  },
  remove: async (id) => {
    await request<{ ok: boolean }>('DELETE', `/api/users/${id}`);
    set((s) => ({ users: s.users.filter((u) => u.id !== id) }));
  },
  nameFor: (id) => {
    const u = get().users.find((x) => x.id === id);
    return u ? u.name || u.email : '';
  },
}));
