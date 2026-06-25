import { create } from 'zustand';
import { resource, request } from '@/lib/api';
import { useLeadsStore } from '@/stores/leadsStore';
import type { ContactEnquiry, ContactEnquiryStatus, Lead } from '@/types';

const api = resource<ContactEnquiry>('enquiries');

interface ConvertResult {
  enquiry: ContactEnquiry;
  lead: Lead;
  /** True when a brand-new lead was created (vs. returning an already-linked one). */
  leadCreated: boolean;
}

interface EnquiriesState {
  enquiries: ContactEnquiry[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  updateEnquiry: (id: string, updates: Partial<ContactEnquiry>) => Promise<void>;
  setStatus: (id: string, status: ContactEnquiryStatus) => Promise<void>;
  deleteEnquiry: (id: string) => Promise<void>;
  /**
   * Convert an enquiry into a Lead via the server's `/convert` endpoint, then
   * sync both stores from the authoritative result.
   */
  convert: (id: string) => Promise<ConvertResult>;
}

export const useEnquiriesStore = create<EnquiriesState>()((set, get) => ({
  enquiries: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const enquiries = await api.list();
      set({ enquiries, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  updateEnquiry: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ enquiries: s.enquiries.map((e) => (e.id === id ? updated : e)) }));
  },

  setStatus: (id, status) => get().updateEnquiry(id, { status }),

  deleteEnquiry: async (id) => {
    await api.remove(id);
    set((s) => ({ enquiries: s.enquiries.filter((e) => e.id !== id) }));
  },

  convert: async (id) => {
    const result = await request<ConvertResult>('POST', `/api/enquiries/${id}/convert`, {});
    // Reflect the converted enquiry locally.
    set((s) => ({
      enquiries: s.enquiries.map((e) => (e.id === result.enquiry.id ? result.enquiry : e)),
    }));
    // Mirror the new lead into the Leads store if it isn't there already.
    useLeadsStore.setState((s) => ({
      leads: s.leads.some((l) => l.id === result.lead.id)
        ? s.leads.map((l) => (l.id === result.lead.id ? result.lead : l))
        : [...s.leads, result.lead],
    }));
    return result;
  },
}));
