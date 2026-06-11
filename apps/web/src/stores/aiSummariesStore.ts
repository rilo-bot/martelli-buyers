import { create } from 'zustand';
import { resource, request } from '@/lib/api';
import type { AISummary, ActionItem } from '@/types';

const api = resource<AISummary>('ai-summaries');

interface GeneratedSummary {
  summary: string;
  actionItems: { description: string; assignedTo: string; dueDate: string }[];
}

interface AISummariesState {
  summaries: AISummary[];
  isGenerating: boolean;
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addSummary: (summary: Omit<AISummary, 'id' | 'createdAt'>) => Promise<AISummary>;
  updateSummary: (id: string, updates: Partial<AISummary>) => Promise<void>;
  deleteSummary: (id: string) => Promise<void>;
  toggleActionItem: (summaryId: string, actionItemId: string) => Promise<void>;
  generateSummary: (dealId: string, type: 'call' | 'meeting', title: string, participants: string[], rawTranscript: string) => Promise<AISummary>;
  getSummariesForDeal: (dealId: string) => AISummary[];
}

export const useAISummariesStore = create<AISummariesState>()((set, get) => ({
  summaries: [],
  isGenerating: false,
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const summaries = await api.list();
      set({ summaries, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addSummary: async (data) => {
    const summary = await api.create(data);
    set((s) => ({ summaries: [...s.summaries, summary] }));
    return summary;
  },

  updateSummary: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ summaries: s.summaries.map((s2) => (s2.id === id ? updated : s2)) }));
  },

  deleteSummary: async (id) => {
    await api.remove(id);
    set((s) => ({ summaries: s.summaries.filter((s2) => s2.id !== id) }));
  },

  toggleActionItem: (summaryId, actionItemId) => {
    const summary = get().summaries.find((s) => s.id === summaryId);
    if (!summary) return Promise.resolve();
    return get().updateSummary(summaryId, {
      actionItems: summary.actionItems.map((item) =>
        item.id === actionItemId ? { ...item, completed: !item.completed } : item,
      ),
    });
  },

  generateSummary: async (dealId, type, title, participants, rawTranscript) => {
    set({ isGenerating: true });
    try {
      // Real generation happens server-side (Gemini via OpenRouter); the key never reaches the browser.
      const generated = await request<GeneratedSummary>('POST', '/api/ai/summarize', {
        type,
        title,
        participants,
        transcript: rawTranscript,
      });
      const actionItems: ActionItem[] = generated.actionItems.map((a) => ({
        id: crypto.randomUUID(),
        description: a.description,
        assignedTo: a.assignedTo,
        dueDate: a.dueDate,
        completed: false,
      }));
      return await get().addSummary({
        dealId,
        type,
        title,
        date: new Date().toISOString().split('T')[0],
        participants,
        summary: generated.summary,
        actionItems,
        rawTranscript,
        isVisibleToClient: false,
        generatedAt: new Date().toISOString(),
      });
    } finally {
      set({ isGenerating: false });
    }
  },

  getSummariesForDeal: (dealId) => get().summaries.filter((s) => s.dealId === dealId),
}));
