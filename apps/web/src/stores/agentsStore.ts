import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Agent, AgentGeo } from '@/types';

const api = resource<Agent>('agents');

interface AgentsState {
  agents: Agent[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addAgent: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Agent>;
  updateAgent: (id: string, updates: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  togglePreferred: (id: string) => Promise<void>;
  getByGeo: (geo: AgentGeo) => Agent[];
  getPreferred: () => Agent[];
}

export const useAgentsStore = create<AgentsState>()((set, get) => ({
  agents: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const agents = await api.list();
      set({ agents, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addAgent: async (data) => {
    const agent = await api.create(data);
    set((s) => ({ agents: [...s.agents, agent] }));
    return agent;
  },

  updateAgent: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ agents: s.agents.map((a) => (a.id === id ? updated : a)) }));
  },

  deleteAgent: async (id) => {
    await api.remove(id);
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
  },

  togglePreferred: (id) => {
    const agent = get().agents.find((a) => a.id === id);
    if (!agent) return Promise.resolve();
    return get().updateAgent(id, { isPreferred: !agent.isPreferred });
  },

  getByGeo: (geo) => get().agents.filter((a) => a.geoTag === geo),
  getPreferred: () => get().agents.filter((a) => a.isPreferred),
}));
