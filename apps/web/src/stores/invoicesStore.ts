import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { Invoice, InvoiceStatus } from '@/types';

const api = resource<Invoice>('invoices');

interface InvoicesState {
  invoices: Invoice[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  updateStatus: (id: string, status: InvoiceStatus) => Promise<void>;
  getInvoicesForDeal: (dealId: string) => Invoice[];
  syncWithXero: (invoiceId: string) => Promise<{ ok: boolean; xeroId?: string; error?: string }>;
}

export const useInvoicesStore = create<InvoicesState>()((set, get) => ({
  invoices: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const invoices = await api.list();
      set({ invoices, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addInvoice: async (data) => {
    const invoice = await api.create(data);
    set((s) => ({ invoices: [...s.invoices, invoice] }));
    return invoice;
  },

  updateInvoice: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ invoices: s.invoices.map((inv) => (inv.id === id ? updated : inv)) }));
  },

  deleteInvoice: async (id) => {
    await api.remove(id);
    set((s) => ({ invoices: s.invoices.filter((inv) => inv.id !== id) }));
  },

  updateStatus: (id, status) => get().updateInvoice(id, { status }),

  getInvoicesForDeal: (dealId) => get().invoices.filter((inv) => inv.dealId === dealId),

  // Mock Xero sync — flips status to "sent" and stamps a fake external id.
  syncWithXero: async (invoiceId) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const xeroId = `XERO-${Date.now()}`;
    await get().updateInvoice(invoiceId, { xeroInvoiceId: xeroId, status: 'sent' });
    return { ok: true, xeroId };
  },
}));
