import { create } from 'zustand'
import { getOutlookStatus, type OutlookStatus } from '@/lib/outlook'

interface OutlookState extends OutlookStatus {
  loaded: boolean
  fetchStatus: () => Promise<void>
}

export const useOutlookStore = create<OutlookState>()((set) => ({
  configured: false,
  connected: false,
  accountEmail: '',
  connectedByEmail: '',
  syncStatus: 'idle',
  lastSyncAt: '',
  syncedCount: 0,
  syncError: '',
  loaded: false,
  fetchStatus: async () => {
    const status = await getOutlookStatus()
    set({ ...status, loaded: true })
  },
}))
