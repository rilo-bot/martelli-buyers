import { create } from 'zustand';
import { request } from '@/lib/api';
import type { CompanySettings } from '@/types';

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
}));
