import type { CreateMeetingInput } from '@rilo/shared';
import { env } from '../env';

/**
 * Thin server-side client for the external RILO Meet API
 * (https://decoded-studios-api.onrender.com). The API key is held server-side
 * and forwarded as the `x-rilo-meet-key` header — it must never reach the
 * browser, so every Meet call goes through this module via the `/api/meet`
 * proxy routes.
 */

export interface MeetResult {
  /** True when the upstream returned a 2xx. */
  ok: boolean;
  /** Upstream HTTP status (or 502 when the upstream was unreachable). */
  status: number;
  /** Parsed JSON body (or a string for non-JSON responses). */
  data: unknown;
}

/** One fetch to the RILO Meet API with auth + JSON headers attached. */
async function meetFetch(path: string, init?: RequestInit): Promise<MeetResult> {
  let res: Response;
  try {
    res = await fetch(`${env.MEET.baseUrl}${path}`, {
      ...init,
      headers: {
        'x-rilo-meet-key': env.MEET.apiKey,
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  } catch (err) {
    // Network failure / DNS / upstream down — surface as a 502 so the proxy
    // route can tell the client the meeting service is unreachable.
    console.error('[meet] upstream request failed:', (err as Error).message);
    return { ok: false, status: 502, data: { error: 'Could not reach the meeting service. Please try again.' } };
  }

  // RILO returns JSON for both success and documented errors; tolerate empties
  // and the occasional non-JSON body without throwing.
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = { error: text }; }
  }
  return { ok: res.ok, status: res.status, data };
}

/** GET /api/v1/meetings — optionally filtered by status (e.g. "live"). */
export function listMeetings(status?: string): Promise<MeetResult> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  return meetFetch(`/api/v1/meetings${qs}`, { method: 'GET' });
}

/** POST /api/v1/meetings — create an instant or scheduled meeting. */
export function createMeeting(input: CreateMeetingInput): Promise<MeetResult> {
  return meetFetch('/api/v1/meetings', { method: 'POST', body: JSON.stringify(input) });
}
