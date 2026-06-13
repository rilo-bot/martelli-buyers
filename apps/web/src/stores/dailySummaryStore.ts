import { create } from 'zustand'
import { request } from '@/lib/api'

export interface DailySummaryItem {
  text: string
  /** Optional in-app route to deep-link the insight. */
  to: string
}

export interface DailySummaryResult {
  date: string
  role: string
  headline: string
  insights: DailySummaryItem[]
  focus: string
  generatedAt: string
  cached: boolean
}

type Status = 'idle' | 'loading' | 'ready' | 'error'

interface DailySummaryState {
  summary: DailySummaryResult | null
  status: Status
  error: string
  /** Load today's briefing (cached server-side). Pass true to force regeneration. */
  fetch: (refresh?: boolean) => Promise<void>
}

export const useDailySummaryStore = create<DailySummaryState>()((set, get) => ({
  summary: null,
  status: 'idle',
  error: '',
  fetch: async (refresh = false) => {
    // Don't refetch a loaded briefing on every dashboard visit unless refreshing.
    if (!refresh && (get().status === 'loading' || get().summary)) return
    set({ status: 'loading', error: '' })
    try {
      const summary = await request<DailySummaryResult>(
        'GET',
        `/api/ai/daily-summary${refresh ? '?refresh=1' : ''}`,
      )
      set({ summary, status: 'ready', error: '' })
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Could not load your daily briefing.',
      })
    }
  },
}))
