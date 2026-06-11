import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { QualificationStage, StageChecklistItem } from '@/types';

const api = resource<QualificationStage>('qualification-stages');

// Used only by resetToDefaults(); the server seeds these on a fresh database.
const DEFAULT_STAGES: Omit<QualificationStage, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    label: 'Discovery Call',
    description: "Initial call to understand the buyer's needs and situation.",
    order: 0,
    color: 'cyan',
    checklistItems: [
      { id: 'dc-1', label: 'Call completed', description: 'Discovery call has taken place.', required: true, order: 0 },
      { id: 'dc-2', label: 'Budget confirmed', description: 'Buyer budget range established and recorded.', required: true, order: 1 },
      { id: 'dc-3', label: 'Property criteria captured', description: 'Suburb preferences, property type, bed/bath noted.', required: true, order: 2 },
      { id: 'dc-4', label: 'Pre-approval status noted', description: 'Finance pre-approval status confirmed with buyer.', required: false, order: 3 },
    ],
  },
  {
    label: 'In-Person Meeting',
    description: 'Face-to-face meeting to deepen the relationship and present services.',
    order: 1,
    color: 'violet',
    checklistItems: [
      { id: 'ipm-1', label: 'Meeting scheduled', description: 'In-person meeting time and location confirmed.', required: true, order: 0 },
      { id: 'ipm-2', label: 'Services presentation delivered', description: "Buyer's agency services, fees and process explained.", required: true, order: 1 },
      { id: 'ipm-3', label: 'Client questions addressed', description: 'All buyer questions noted and answered.', required: false, order: 2 },
      { id: 'ipm-4', label: 'Agreement discussion initiated', description: 'Buyer agency agreement terms introduced.', required: true, order: 3 },
    ],
  },
  {
    label: 'Paperwork',
    description: "Buyer's agency agreement and supporting documents sent for review.",
    order: 2,
    color: 'amber',
    checklistItems: [
      { id: 'pw-1', label: 'Agreement sent to buyer', description: "Buyer's agency agreement emailed for review.", required: true, order: 0 },
      { id: 'pw-2', label: 'ID verification complete', description: 'AML/ID documents collected and verified.', required: true, order: 1 },
      { id: 'pw-3', label: 'Fee structure confirmed', description: 'Engagement fee, success fee and GST agreed in writing.', required: true, order: 2 },
      { id: 'pw-4', label: 'Follow-up sent', description: 'Follow-up reminder sent if no response within 48 hours.', required: false, order: 3 },
    ],
  },
  {
    label: 'Signed Client',
    description: 'Agreement signed — buyer is now an active client.',
    order: 3,
    color: 'emerald',
    checklistItems: [
      { id: 'sc-1', label: 'Agreement signed and returned', description: 'Countersigned agreement received from buyer.', required: true, order: 0 },
      { id: 'sc-2', label: 'Engagement invoice issued', description: 'Xero engagement invoice created and sent.', required: true, order: 1 },
      { id: 'sc-3', label: 'Client portal access granted', description: 'Portal login sent to client.', required: false, order: 2 },
      { id: 'sc-4', label: 'Welcome email sent', description: 'Branded welcome email dispatched with next steps.', required: true, order: 3 },
    ],
  },
];

interface QualificationStagesState {
  stages: QualificationStage[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addStage: (data: Omit<QualificationStage, 'id' | 'createdAt' | 'updatedAt' | 'order' | 'checklistItems'>) => Promise<QualificationStage>;
  updateStage: (id: string, updates: Partial<Omit<QualificationStage, 'id' | 'createdAt'>>) => Promise<void>;
  deleteStage: (id: string) => Promise<void>;
  reorderStages: (orderedIds: string[]) => Promise<void>;
  resetToDefaults: () => Promise<void>;
  addChecklistItem: (stageId: string, data: Omit<StageChecklistItem, 'id' | 'order'>) => Promise<StageChecklistItem>;
  updateChecklistItem: (stageId: string, itemId: string, updates: Partial<Omit<StageChecklistItem, 'id'>>) => Promise<void>;
  deleteChecklistItem: (stageId: string, itemId: string) => Promise<void>;
  reorderChecklistItems: (stageId: string, orderedIds: string[]) => Promise<void>;
}

export const useQualificationStagesStore = create<QualificationStagesState>()((set, get) => ({
  stages: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const stages = await api.list();
      set({ stages, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addStage: async (data) => {
    const stages = get().stages;
    const maxOrder = stages.length > 0 ? Math.max(...stages.map((s) => s.order)) : -1;
    const stage = await api.create({ ...data, order: maxOrder + 1, checklistItems: [] });
    set((s) => ({ stages: [...s.stages, stage] }));
    return stage;
  },

  updateStage: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ stages: s.stages.map((st) => (st.id === id ? updated : st)) }));
  },

  deleteStage: async (id) => {
    await api.remove(id);
    set((s) => ({ stages: s.stages.filter((st) => st.id !== id) }));
  },

  reorderStages: async (orderedIds) => {
    const updated = await Promise.all(
      orderedIds.map((id, idx) => api.update(id, { order: idx })),
    );
    const byId = new Map(updated.map((st) => [st.id, st]));
    set((s) => ({ stages: s.stages.map((st) => byId.get(st.id) ?? st) }));
  },

  resetToDefaults: async () => {
    await Promise.all(get().stages.map((st) => api.remove(st.id)));
    const created = await Promise.all(DEFAULT_STAGES.map((st) => api.create(st)));
    set({ stages: created });
  },

  addChecklistItem: async (stageId, data) => {
    const stage = get().stages.find((s) => s.id === stageId);
    if (!stage) throw new Error('Stage not found');
    const maxOrder = stage.checklistItems.length > 0 ? Math.max(...stage.checklistItems.map((i) => i.order)) : -1;
    const item: StageChecklistItem = { ...data, id: crypto.randomUUID(), order: maxOrder + 1 };
    await get().updateStage(stageId, { checklistItems: [...stage.checklistItems, item] });
    return item;
  },

  updateChecklistItem: (stageId, itemId, updates) => {
    const stage = get().stages.find((s) => s.id === stageId);
    if (!stage) return Promise.resolve();
    return get().updateStage(stageId, {
      checklistItems: stage.checklistItems.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item,
      ),
    });
  },

  deleteChecklistItem: (stageId, itemId) => {
    const stage = get().stages.find((s) => s.id === stageId);
    if (!stage) return Promise.resolve();
    return get().updateStage(stageId, {
      checklistItems: stage.checklistItems
        .filter((item) => item.id !== itemId)
        .map((item, idx) => ({ ...item, order: idx })),
    });
  },

  reorderChecklistItems: (stageId, orderedIds) => {
    const stage = get().stages.find((s) => s.id === stageId);
    if (!stage) return Promise.resolve();
    const itemMap = new Map(stage.checklistItems.map((i) => [i.id, i]));
    const reordered = orderedIds
      .map((id, idx) => {
        const item = itemMap.get(id);
        return item ? { ...item, order: idx } : null;
      })
      .filter(Boolean) as StageChecklistItem[];
    return get().updateStage(stageId, { checklistItems: reordered });
  },
}));
