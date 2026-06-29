import type { Request, Response, NextFunction } from 'express';
import { ALL_PERMISSIONS, ALWAYS_GRANTED, PERMISSION_MODULES } from '@rilo/shared';
import { Role } from '../models';
import { isSuperAdminEmail } from '../env';

/**
 * RBAC permission engine.
 *
 * Effective permissions for a request are computed once in `requireAuth` and
 * attached to `req.auth`. The super admin (env-configured email) always has
 * every permission and can never be locked out. Everyone else gets their
 * Role's permission set (cached) plus the always-granted baseline.
 */

// roleKey → permission Set. Cleared whenever a role is mutated so changes take
// effect on the next request.
const roleCache = new Map<string, Set<string>>();

/** Drop the cached permission sets — call after any role create/edit/delete. */
export function invalidateRolesCache(): void {
  roleCache.clear();
}

const ALL_SET = new Set<string>([...ALL_PERMISSIONS, ...ALWAYS_GRANTED]);

async function permissionsForRole(roleKey: string): Promise<Set<string>> {
  const cached = roleCache.get(roleKey);
  if (cached) return cached;
  const role = await Role.findOne({ key: roleKey }).lean();
  // Unknown / deleted role → baseline only (deny everything but the dashboard).
  const perms = new Set<string>([
    ...ALWAYS_GRANTED,
    ...(((role as { permissions?: string[] } | null)?.permissions) ?? []),
  ]);
  roleCache.set(roleKey, perms);
  return perms;
}

export interface EffectivePermissions {
  permissions: Set<string>;
  isSuperAdmin: boolean;
}

/** Resolve the effective permission set + super-admin flag for a user. */
export async function getEffectivePermissions(user: {
  email?: string;
  role?: string;
}): Promise<EffectivePermissions> {
  if (isSuperAdminEmail(user.email)) {
    return { permissions: ALL_SET, isSuperAdmin: true };
  }
  const permissions = await permissionsForRole(user.role || 'staff');
  return { permissions, isSuperAdmin: false };
}

/** True when the request's user is an admin (role) or the env super-admin. */
export function isAdmin(req: Request): boolean {
  if (req.auth?.isSuperAdmin) return true;
  const role = req.auth?.user?.get?.('role') ?? req.auth?.user?.role;
  return role === 'admin';
}

/**
 * Anti-download gate: who may SAVE a file (vs merely preview it). The owner is
 * the uploader for catalogued uploads, or the assigned agent for generated docs
 * (passed in as `ownerId`). Admins and the super-admin can always download;
 * everyone else is preview-only. A blank `ownerId` means "no owner", so only
 * admins qualify.
 */
export function canDownloadDoc(req: Request, ownerId: string): boolean {
  if (isAdmin(req)) return true;
  return Boolean(ownerId) && req.session.userId === ownerId;
}

/**
 * Preview gate for a catalogued document. Grants inline-preview access to:
 *  - admins / the super-admin,
 *  - anyone holding the global `documents:view` permission (unchanged behaviour),
 *  - the document's uploader,
 *  - any user the document has been explicitly shared with (preview-only),
 *    even if they hold no Documents permission at all.
 */
export function canPreviewDoc(
  req: Request,
  doc: { uploadedBy?: string; sharedWith?: string[] },
): boolean {
  if (req.auth?.isSuperAdmin) return true;
  if (req.auth?.permissions.has('documents:view')) return true;
  const uid = req.session.userId;
  if (!uid) return false;
  if (doc.uploadedBy === uid) return true;
  return (doc.sharedWith ?? []).includes(uid);
}

/** Express middleware: 403 unless the request's effective permissions include `perm`. */
export function requirePermission(perm: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.auth?.isSuperAdmin || req.auth?.permissions.has(perm)) {
      next();
      return;
    }
    res.status(403).json({ error: 'You do not have permission to perform this action.' });
  };
}

/* ───────────────────────── AI helpers (RBAC context) ─────────────────────
 * Used by the in-app assistant and the daily summary to tailor AI output to
 * exactly what the signed-in user is allowed to see and do. Always derived
 * from the server-side effective permissions — never from the client.
 * ------------------------------------------------------------------------- */

export interface AuthContext {
  permissions: Set<string>;
  isSuperAdmin: boolean;
  role?: string;
}

/** Build an AuthContext from a populated `req.auth` (and the user's role). */
export function authContextFromRequest(req: Request): AuthContext {
  return {
    permissions: req.auth?.permissions ?? new Set<string>(),
    isSuperAdmin: Boolean(req.auth?.isSuperAdmin),
    role: req.auth?.user?.get?.('role') ?? req.auth?.user?.role,
  };
}

/** Module keys the user can view — drives RBAC-scoped data gathering. */
export function viewableModules(auth: AuthContext): Set<string> {
  const out = new Set<string>();
  for (const mod of PERMISSION_MODULES) {
    if (auth.isSuperAdmin || auth.permissions.has(`${mod.key}:view`)) out.add(mod.key);
  }
  return out;
}

/**
 * Human-readable description of what the user can do, injected into AI prompts
 * so guidance and summaries respect the user's RBAC permissions.
 */
export function describeCapabilities(auth: AuthContext): string {
  if (auth.isSuperAdmin) {
    return 'This user is the super administrator: full access to every area, including managing team members and roles.';
  }
  const lines = PERMISSION_MODULES.map((mod) => {
    const held = mod.actions.filter((a) => auth.permissions.has(`${mod.key}:${a}`));
    return held.length === 0 ? `- ${mod.label}: no access` : `- ${mod.label}: can ${held.join(', ')}`;
  });
  const roleLine = auth.role ? `Their role is "${auth.role}".\n` : '';
  return (
    `${roleLine}Permissions by area (verbs: view, create, edit, delete, send, manage):\n` +
    lines.join('\n')
  );
}
