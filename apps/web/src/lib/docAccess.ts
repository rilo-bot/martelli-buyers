import type { User } from '@/types'

/**
 * Mirrors the server's `canDownloadDoc` gate (apps/server/src/lib/permissions.ts):
 * a file may be saved only by its owner (the uploader, or the assigned agent for
 * generated docs) plus admins and the super-admin. Everyone else is preview-only.
 *
 * This is a UI hint only — it decides whether to render a Download affordance.
 * The server is the real gate, so a non-owner who reaches the download endpoint
 * still gets a 403.
 */
export function canDownloadDoc(ownerId: string, user: User | null): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  if (user.role === 'admin') return true
  return Boolean(ownerId) && user.id === ownerId
}

/**
 * Who may share a document with internal users (preview-only access): admins and
 * the super-admin only. Mirrors the server's `isAdmin` gate on the share route.
 */
export function canShareDoc(user: User | null): boolean {
  if (!user) return false
  return Boolean(user.isSuperAdmin) || user.role === 'admin'
}
