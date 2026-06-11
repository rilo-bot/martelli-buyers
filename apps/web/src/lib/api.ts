/**
 * Browser calls to the Express API.
 * - Dev: VITE_API_URL unset → relative `/api/...` paths use the Vite proxy.
 * - Prod: VITE_API_URL is the backend origin (injected at build time).
 */
export function getApiOrigin(): string {
  const v = import.meta.env.VITE_API_URL
  if (typeof v !== 'string' || !v.trim()) return ''
  let o = v.trim()
  while (o.endsWith('/')) o = o.slice(0, -1)
  return o
}

/** Use for every `fetch` to the backend (path must start with `/api`). */
export function apiUrl(apiPath: string): string {
  const path = apiPath.startsWith('/') ? apiPath : `/${apiPath}`
  const origin = getApiOrigin()
  return origin ? `${origin}${path}` : path
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

/** Core fetch wrapper: sends cookies, JSON-encodes the body, throws ApiError on failure. */
export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (data?.error) message = data.error
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

/** Typed REST helpers for a `/api/<name>` collection. */
export function resource<T extends { id: string }>(name: string) {
  const base = `/api/${name}`
  return {
    list: () => request<T[]>('GET', base),
    get: (id: string) => request<T>('GET', `${base}/${id}`),
    create: (data: Partial<T>) => request<T>('POST', base, data),
    update: (id: string, data: Partial<T>) => request<T>('PATCH', `${base}/${id}`, data),
    remove: (id: string) => request<{ ok: boolean }>('DELETE', `${base}/${id}`),
  }
}
