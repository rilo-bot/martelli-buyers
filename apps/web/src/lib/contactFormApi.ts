import { apiUrl, ApiError } from './api'
import type { PublicContactForm } from '@rilo/shared'

/**
 * Fetch + submit helpers for the public contact form. Unlike the rest of the
 * app these MUST NOT send cookies: the public endpoints use origin-reflecting
 * CORS without `Allow-Credentials`, so a credentialed request would be blocked
 * by the browser. They are cross-origin in production (web ≠ API origin) either
 * way, hosted or embedded.
 */

async function errorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json()
    if (data?.error) return data.error as string
  } catch {
    /* non-JSON body */
  }
  return res.statusText
}

/** GET the published form config. Pass a token for an embed; omit for the hosted page. */
export async function getPublicForm(token?: string): Promise<PublicContactForm> {
  const path = token ? `/api/public/form/${encodeURIComponent(token)}` : '/api/public/form'
  let res: Response
  try {
    res = await fetch(apiUrl(path), { method: 'GET', credentials: 'omit' })
  } catch {
    throw new ApiError(0, 'Could not load the form. Please try again.')
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
  return res.json()
}

export interface ContactSubmitPayload {
  values: Record<string, string | boolean>
  /** Honeypot — bots fill it, humans never see it. */
  _hp: string
  /** Milliseconds the form was on screen before submit (spam heuristic). */
  _elapsedMs: number
}

/** Submit the form. Pass the token for an embed; null for the hosted page. */
export async function submitPublicForm(token: string | null, payload: ContactSubmitPayload): Promise<void> {
  const path = token ? `/api/public/form/${encodeURIComponent(token)}/submit` : '/api/public/form/submit'
  let res: Response
  try {
    res = await fetch(apiUrl(path), {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    throw new ApiError(0, 'Could not reach the server. Please try again.')
  }
  if (!res.ok) throw new ApiError(res.status, await errorMessage(res))
}
