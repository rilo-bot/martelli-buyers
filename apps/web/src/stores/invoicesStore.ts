import { create } from 'zustand';
import { resource } from '@/lib/api';
import { emailInvoice as emailInvoiceApi, remindInvoice as remindInvoiceApi } from '@/lib/documents';
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
  emailInvoice: (invoiceId: string) => Promise<void>;
  /** Re-email an outstanding invoice as a reminder and sync the updated copy. */
  remindInvoice: (invoiceId: string) => Promise<void>;
  /** Replace an invoice in state with an authoritative server copy (e.g. after a Xero sync). */
  replaceInvoice: (invoice: Invoice) => void;
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

  remindInvoice: async (invoiceId) => {
    const updated = await remindInvoiceApi(invoiceId);
    set((s) => ({ invoices: s.invoices.map((inv) => (inv.id === invoiceId ? updated : inv)) }));
  },

  replaceInvoice: (invoice) =>
    set((s) => ({ invoices: s.invoices.map((inv) => (inv.id === invoice.id ? invoice : inv)) })),

  // Generate the invoice PDF server-side and email it to the client. The server
  // flips a draft invoice to "sent"; reflect that locally.
  emailInvoice: async (invoiceId) => {
    const { status } = await emailInvoiceApi(invoiceId);
    set((s) => ({
      invoices: s.invoices.map((inv) =>
        inv.id === invoiceId ? { ...inv, status: status as InvoiceStatus } : inv,
      ),
    }));
  },
}));
