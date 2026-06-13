import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Task } from '@/types';

const api = resource<Task>('tasks');

interface TasksState {
  tasks: Task[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  toggleComplete: (id: string, completed: boolean) => Promise<void>;
  getTasksForDeal: (dealId: string) => Task[];
}

export const useTasksStore = create<TasksState>()((set, get) => ({
  tasks: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const tasks = await api.list();
      set({ tasks, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addTask: async (data) => {
    const task = await api.create(data);
    set((s) => ({ tasks: [...s.tasks, task] }));
    return task;
  },

  updateTask: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteTask: async (id) => {
    await api.remove(id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  toggleComplete: (id, completed) =>
    get().updateTask(id, { completed, completedAt: completed ? new Date().toISOString() : '' }),

  getTasksForDeal: (dealId) => get().tasks.filter((t) => t.dealId === dealId),
}));
