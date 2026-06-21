import { create } from 'zustand';
import { resource } from '@/lib/api';
import { deleteUpload } from '@/lib/upload';
import { DD_CHECKLIST_TEMPLATE_DEFAULTS } from '@/types';
import type { DueDiligence, EvidenceItem, ComparableSale, DDChecklistItem, ChecklistItemStatus } from '@/types';
import { useCompanySettingsStore } from '@/stores/companySettingsStore';

const api = resource<DueDiligence>('due-diligence');

/** A checklist item counts as resolved once it's Completed or marked N/A. */
const isResolved = (status: ChecklistItemStatus) => status === 'completed' || status === 'na';

export interface DealDdStatus {
  total: number;
  resolved: number;
  /** True iff ≥1 linked DD record exists and every item across them is resolved. */
  complete: boolean;
  recordCount: number;
}

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
  /** Aggregate DD completion for a buyer journey — mirrors the server stage gate. */
  dealDdStatus: (dealId: string) => DealDdStatus;
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
    const target = record.evidenceLinks.find((e) => e.id === evidenceId);
    // Best-effort reclaim of the S3 object for uploaded (non-link) evidence.
    if (target && target.type !== 'link') deleteUpload(target.url).catch(() => {});
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

  // Snapshot the org's enabled template items into a fresh checklist. Reads the
  // admin-configured template from company settings (Settings → Due Diligence);
  // falls back to the full default set if settings haven't loaded or the org has
  // no template yet, so behaviour is unchanged until an admin customises it.
  generateDefaultChecklist: () => {
    const template = useCompanySettingsStore.getState().settings?.ddChecklistTemplate;
    const source = template && template.length > 0 ? template : DD_CHECKLIST_TEMPLATE_DEFAULTS;
    return source
      .filter((item) => item.enabled)
      .map((item) => ({
        id: item.id,
        label: item.label,
        section: item.section ?? '',
        status: 'pending' as ChecklistItemStatus,
        notes: '',
        completedBy: '',
        completedAt: '',
      }));
  },

  getRecordForProperty: (propertyId) => get().records.find((r) => r.propertyId === propertyId),

  dealDdStatus: (dealId) => {
    const recs = get().records.filter((r) => r.dealId === dealId);
    let total = 0;
    let resolved = 0;
    for (const r of recs) {
      for (const item of r.checklistItems) {
        total += 1;
        if (isResolved(item.status)) resolved += 1;
      }
    }
    return { total, resolved, recordCount: recs.length, complete: recs.length > 0 && resolved === total };
  },
}));
