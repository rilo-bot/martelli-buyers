import { create } from 'zustand'
import { request } from '@/lib/api'

/** Server capability flags — which integrations are configured. */
interface ServerConfig {
  hasEmail: boolean
  hasAi: boolean
  hasS3: boolean
  hasXero: boolean
  hasOutlook: boolean
}

interface ConfigState extends ServerConfig {
  loaded: boolean
  fetch: () => Promise<void>
}

export const useConfigStore = create<ConfigState>()((set) => ({
  hasEmail: false,
  hasAi: false,
  hasS3: false,
  hasXero: false,
  hasOutlook: false,
  loaded: false,
  fetch: async () => {
    const cfg = await request<ServerConfig>('GET', '/api/config')
    set({ ...cfg, loaded: true })
  },
}))
