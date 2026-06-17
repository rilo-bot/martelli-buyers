import { create } from 'zustand'
import { resource } from '@/lib/api'
import type { EmailMessage } from '@/types'

const api = resource<EmailMessage>('email-messages')

interface LinkTarget {
  clientId: string
  dealId: string
  /** Current user id, stamped as linkedBy. */
  linkedBy?: string
}

interface EmailMessagesState {
  emails: EmailMessage[]
  loading: boolean
  loaded: boolean
  fetch: () => Promise<void>
  /** Tag/link an email to a client and/or deal (manual tagging). */
  link: (id: string, target: LinkTarget) => Promise<void>
  /** Remove a link (untag). */
  unlink: (id: string) => Promise<void>
  forDeal: (dealId: string) => EmailMessage[]
  forClient: (clientId: string) => EmailMessage[]
  unlinked: () => EmailMessage[]
}

/** Newest first by the email's own timestamp (sent or received), not createdAt. */
function emailTime(e: EmailMessage): number {
  return new Date(e.receivedAt || e.sentAt || e.createdAt).getTime()
}

export const useEmailMessagesStore = create<EmailMessagesState>()((set, get) => ({
  emails: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true })
    try {
      const emails = await api.list()
      emails.sort((a, b) => emailTime(b) - emailTime(a))
      set({ emails, loaded: true })
    } finally {
      set({ loading: false })
    }
  },

  link: async (id, target) => {
    const updated = await api.update(id, {
      clientId: target.clientId,
      dealId: target.dealId,
      linkedBy: target.linkedBy ?? '',
    })
    set((s) => ({ emails: s.emails.map((e) => (e.id === id ? updated : e)) }))
  },

  unlink: async (id) => {
    const updated = await api.update(id, { clientId: '', dealId: '', linkSource: '' })
    set((s) => ({ emails: s.emails.map((e) => (e.id === id ? updated : e)) }))
  },

  forDeal: (dealId) => get().emails.filter((e) => e.dealId === dealId),
  forClient: (clientId) => get().emails.filter((e) => e.clientId === clientId),
  unlinked: () => get().emails.filter((e) => !e.clientId && !e.dealId),
}))
