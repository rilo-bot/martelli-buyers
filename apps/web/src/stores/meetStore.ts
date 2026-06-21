import { create } from 'zustand';
import { request } from '@/lib/api';
import type { Meeting, CreateMeetingInput } from '@/types';

/**
 * RILO Meet meetings, served through the server-side `/api/meet` proxy (the API
 * key stays on the server). Meetings are external — they have a `meetingId`, not
 * the usual `{ id }` CRUD shape — so this store talks to the proxy directly
 * instead of using the generic `resource()` helper.
 */

/** Pull the meetings array out of whatever envelope the proxy returns. */
function normalizeList(res: unknown): Meeting[] {
  if (Array.isArray(res)) return res as Meeting[];
  const obj = res as { meetings?: Meeting[]; data?: Meeting[] } | null;
  return obj?.meetings ?? obj?.data ?? [];
}

/** Pull the single meeting out of the create response (`{ meeting }` or bare). */
function normalizeCreated(res: unknown): Meeting {
  const obj = res as { meeting?: Meeting } | null;
  return (obj?.meeting ?? res) as Meeting;
}

interface MeetState {
  meetings: Meeting[];
  loading: boolean;
  loaded: boolean;
  /** Load meetings, optionally filtered by status (e.g. 'live'). */
  fetch: (status?: string) => Promise<void>;
  /** Create an instant or scheduled meeting; prepends it to the list. */
  create: (input: CreateMeetingInput) => Promise<Meeting>;
}

export const useMeetStore = create<MeetState>()((set) => ({
  meetings: [],
  loading: false,
  loaded: false,

  fetch: async (status) => {
    set({ loading: true });
    try {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      const res = await request<unknown>('GET', `/api/meet/meetings${qs}`);
      set({ meetings: normalizeList(res), loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  create: async (input) => {
    const res = await request<unknown>('POST', '/api/meet/meetings', input);
    const meeting = normalizeCreated(res);
    // Some upstreams return only a partial body on create — guard the prepend so
    // a missing meetingId doesn't break the list. The page also refetches.
    if (meeting?.meetingId) {
      set((s) => ({ meetings: [meeting, ...s.meetings.filter((m) => m.meetingId !== meeting.meetingId)] }));
    }
    return meeting;
  },
}));
