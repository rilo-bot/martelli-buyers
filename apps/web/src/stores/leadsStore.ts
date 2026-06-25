import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Lead, LeadStatus, LeadStageProgress } from '@/types';

const api = resource<Lead>('leads');

// Agreement fields are authored later on the lead and server-defaulted, so they
// aren't required when creating a lead.
type LeadAgreementKey =
  | 'agreementStatus' | 'agreementUrl' | 'agreementSignToken' | 'agreementSentAt'
  | 'agreementSignerName' | 'agreementSignedAt' | 'agreementSignerIp'
  | 'agreementSignatureImage' | 'agreementBodyHtml';
type NewLead = Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'stageProgress' | LeadAgreementKey>
  & { stageProgress?: LeadStageProgress };

interface LeadsState {
  leads: Lead[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addLead: (lead: NewLead) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;
  updateLeadStatus: (id: string, status: LeadStatus) => Promise<void>;
  updateLeadQualificationStage: (id: string, qualificationStageId: string) => Promise<void>;
  /** Toggle a checklist item completion for a specific stage on a lead */
  toggleStageChecklistItem: (leadId: string, stageId: string, itemId: string) => Promise<void>;
  /** Mark all required checklist items for a stage as complete (bulk) */
  completeAllStageItems: (leadId: string, stageId: string, itemIds: string[]) => Promise<void>;
  /** Clear all checklist progress for a stage on a lead */
  clearStageProgress: (leadId: string, stageId: string) => Promise<void>;
}

export const useLeadsStore = create<LeadsState>()((set, get) => ({
  leads: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const leads = await api.list();
      set({ leads, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addLead: async (leadData) => {
    const lead = await api.create({ ...leadData, stageProgress: leadData.stageProgress ?? {} });
    set((s) => ({ leads: [...s.leads, lead] }));
    return lead;
  },

  updateLead: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ leads: s.leads.map((l) => (l.id === id ? updated : l)) }));
  },

  deleteLead: async (id) => {
    await api.remove(id);
    set((s) => ({ leads: s.leads.filter((l) => l.id !== id) }));
  },

  updateLeadStatus: (id, status) => get().updateLead(id, { status }),

  updateLeadQualificationStage: (id, qualificationStageId) =>
    get().updateLead(id, { qualificationStageId }),

  toggleStageChecklistItem: (leadId, stageId, itemId) => {
    const lead = get().leads.find((l) => l.id === leadId);
    if (!lead) return Promise.resolve();
    const progress: LeadStageProgress = { ...(lead.stageProgress ?? {}) };
    const completed = progress[stageId] ?? [];
    progress[stageId] = completed.includes(itemId)
      ? completed.filter((i) => i !== itemId)
      : [...completed, itemId];
    return get().updateLead(leadId, { stageProgress: progress });
  },

  completeAllStageItems: (leadId, stageId, itemIds) => {
    const lead = get().leads.find((l) => l.id === leadId);
    if (!lead) return Promise.resolve();
    const progress: LeadStageProgress = { ...(lead.stageProgress ?? {}) };
    progress[stageId] = [...itemIds];
    return get().updateLead(leadId, { stageProgress: progress });
  },

  clearStageProgress: (leadId, stageId) => {
    const lead = get().leads.find((l) => l.id === leadId);
    if (!lead) return Promise.resolve();
    const progress: LeadStageProgress = { ...(lead.stageProgress ?? {}) };
    delete progress[stageId];
    return get().updateLead(leadId, { stageProgress: progress });
  },
}));
