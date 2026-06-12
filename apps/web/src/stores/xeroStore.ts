import { create } from 'zustand'
import { getXeroStatus, type XeroStatus } from '@/lib/xero'

interface XeroState extends XeroStatus {
  loaded: boolean
  fetchStatus: () => Promise<void>
}

export const useXeroStore = create<XeroState>()((set) => ({
  configured: false,
  connected: false,
  tenantName: '',
  connectedByEmail: '',
  expiresAt: null,
  importStatus: 'idle',
  lastImportAt: '',
  importedClients: 0,
  linkedInvoices: 0,
  loaded: false,
  fetchStatus: async () => {
    const status = await getXeroStatus()
    set({ ...status, loaded: true })
  },
}))
