import { create } from 'zustand';
import { request } from '@/lib/api';
import type { CompanySettings, ContactFormConfig } from '@/types';

/** The admin-editable slice of the contact form (publish/token stay server-side). */
export interface ContactFormEditableInput {
  fields: ContactFormConfig['fields'];
  styles: ContactFormConfig['styles'];
  content: ContactFormConfig['content'];
  allowedOrigins: string[];
}

/**
 * Org-wide company settings (identity, branding, invoice template). A singleton
 * on the server, so this is a single object rather than a collection — fetched
 * with `settings:view`, saved with `settings:manage`. Loaded at bootstrap so the
 * configured GST rate is available wherever invoices are created.
 */
interface CompanySettingsState {
  settings: CompanySettings | null;
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  save: (updates: Partial<CompanySettings>) => Promise<CompanySettings>;
  // Contact form builder — managed via dedicated server routes so the publish
  // state + token stay server-owned.
  saveContactForm: (input: ContactFormEditableInput) => Promise<ContactFormConfig>;
  publishContactForm: () => Promise<ContactFormConfig>;
  unpublishContactForm: () => Promise<ContactFormConfig>;
  regenerateContactFormToken: () => Promise<ContactFormConfig>;
}

export const useCompanySettingsStore = create<CompanySettingsState>()((set) => ({
  settings: null,
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const settings = await request<CompanySettings>('GET', '/api/company-settings');
      set({ settings, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  save: async (updates) => {
    const settings = await request<CompanySettings>('PUT', '/api/company-settings', updates);
    set({ settings });
    return settings;
  },

  saveContactForm: async (input) => {
    const cf = await request<ContactFormConfig>('PUT', '/api/company-settings/contact-form', input);
    set((s) => (s.settings ? { settings: { ...s.settings, contactForm: cf } } : {}));
    return cf;
  },

  publishContactForm: async () => {
    const cf = await request<ContactFormConfig>('POST', '/api/company-settings/contact-form/publish');
    set((s) => (s.settings ? { settings: { ...s.settings, contactForm: cf } } : {}));
    return cf;
  },

  unpublishContactForm: async () => {
    const cf = await request<ContactFormConfig>('POST', '/api/company-settings/contact-form/unpublish');
    set((s) => (s.settings ? { settings: { ...s.settings, contactForm: cf } } : {}));
    return cf;
  },

  regenerateContactFormToken: async () => {
    const cf = await request<ContactFormConfig>('POST', '/api/company-settings/contact-form/regenerate-token');
    set((s) => (s.settings ? { settings: { ...s.settings, contactForm: cf } } : {}));
    return cf;
  },
}));
