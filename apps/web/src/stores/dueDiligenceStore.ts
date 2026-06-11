import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { DueDiligence, EvidenceItem, ComparableSale, DDChecklistItem, ChecklistItemStatus } from '@/types';

const api = resource<DueDiligence>('due-diligence');

const DEFAULT_CHECKLIST: Omit<DDChecklistItem, 'completedBy' | 'completedAt'>[] = [
  { id: 'dd-1', label: 'Auckland Council flood map reviewed', status: 'pending', notes: '' },
  { id: 'dd-2', label: 'Natural hazards map reviewed (NHRP)', status: 'pending', notes: '' },
  { id: 'dd-3', label: 'LIM report obtained or ordered', status: 'pending', notes: '' },
  { id: 'dd-4', label: 'Title search completed (LINZ)', status: 'pending', notes: '' },
  { id: 'dd-5', label: 'Body corporate minutes reviewed (if applicable)', status: 'pending', notes: '' },
  { id: 'dd-6', label: 'Comparable sales analysis completed (min 5)', status: 'pending', notes: '' },
  { id: 'dd-7', label: 'Building inspection arranged/completed', status: 'pending', notes: '' },
  { id: 'dd-8', label: 'Lawyer reviewed contract', status: 'pending', notes: '' },
  { id: 'dd-9', label: 'Finance/mortgage confirmed', status: 'pending', notes: '' },
  { id: 'dd-10', label: 'Council rates and outgoings confirmed', status: 'pending', notes: '' },
  { id: 'dd-11', label: 'Rental appraisal obtained (if investment)', status: 'pending', notes: '' },
  { id: 'dd-12', label: 'Zoning and development overlay checked', status: 'pending', notes: '' },
  { id: 'dd-13', label: 'OIA (Overseas Investment Act) compliance checked', status: 'pending', notes: '' },
  { id: 'dd-14', label: 'Any easements or covenants noted and reviewed', status: 'pending', notes: '' },
  { id: 'dd-15', label: 'Settlement date and conditions confirmed', status: 'pending', notes: '' },
];

interface DueDiligenceState {
  records: DueDiligence[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addRecord: (record: Omit<DueDiligence, 'id' | 'createdAt' | 'updatedAt'>) => Promise<DueDiligence>;
  updateRecord: (id: string, updates: Partial<DueDiligence>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  addEvidence: (ddId: string, evidence: EvidenceItem) => Promise<void>;
  removeEvidence: (ddId: string, evidenceId: string) => Promise<void>;
  addComparable: (ddId: string, comp: ComparableSale) => Promise<void>;
  updateComparable: (ddId: string, compId: string, updates: Partial<ComparableSale>) => Promise<void>;
  removeComparable: (ddId: string, compId: string) => Promise<void>;
  updateChecklistItem: (ddId: string, itemId: string, status: ChecklistItemStatus, notes?: string, completedBy?: string) => Promise<void>;
  generateDefaultChecklist: () => DDChecklistItem[];
  getRecordForProperty: (propertyId: string) => DueDiligence | undefined;
}

export const useDueDiligenceStore = create<DueDiligenceState>()((set, get) => ({
  records: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const records = await api.list();
      set({ records, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addRecord: async (data) => {
    const record = await api.create(data);
    set((s) => ({ records: [...s.records, record] }));
    return record;
  },

  updateRecord: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ records: s.records.map((r) => (r.id === id ? updated : r)) }));
  },

  deleteRecord: async (id) => {
    await api.remove(id);
    set((s) => ({ records: s.records.filter((r) => r.id !== id) }));
  },

  addEvidence: (ddId, evidence) => {
    const record = get().records.find((r) => r.id === ddId);
    if (!record) return Promise.resolve();
    return get().updateRecord(ddId, { evidenceLinks: [...record.evidenceLinks, evidence] });
  },

  removeEvidence: (ddId, evidenceId) => {
    const record = get().records.find((r) => r.id === ddId);
    if (!record) return Promise.resolve();
    return get().updateRecord(ddId, {
      evidenceLinks: record.evidenceLinks.filter((e) => e.id !== evidenceId),
    });
  },

  addComparable: (ddId, comp) => {
    const record = get().records.find((r) => r.id === ddId);
    if (!record) return Promise.resolve();
    return get().updateRecord(ddId, { comparableSales: [...record.comparableSales, comp] });
  },

  updateComparable: (ddId, compId, updates) => {
    const record = get().records.find((r) => r.id === ddId);
    if (!record) return Promise.resolve();
    return get().updateRecord(ddId, {
      comparableSales: record.comparableSales.map((c) => (c.id === compId ? { ...c, ...updates } : c)),
    });
  },

  removeComparable: (ddId, compId) => {
    const record = get().records.find((r) => r.id === ddId);
    if (!record) return Promise.resolve();
    return get().updateRecord(ddId, {
      comparableSales: record.comparableSales.filter((c) => c.id !== compId),
    });
  },

  updateChecklistItem: (ddId, itemId, status, notes, completedBy) => {
    const record = get().records.find((r) => r.id === ddId);
    if (!record) return Promise.resolve();
    return get().updateRecord(ddId, {
      checklistItems: record.checklistItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status,
              notes: notes ?? item.notes,
              completedBy: completedBy ?? item.completedBy,
              completedAt: status === 'completed' ? new Date().toISOString() : item.completedAt,
            }
          : item,
      ),
    });
  },

  generateDefaultChecklist: () =>
    DEFAULT_CHECKLIST.map((item) => ({ ...item, completedBy: '', completedAt: '' })),

  getRecordForProperty: (propertyId) => get().records.find((r) => r.propertyId === propertyId),
}));
