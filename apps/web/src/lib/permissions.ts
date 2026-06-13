import { useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';

/**
 * Client-side permission gating. Mirrors the server's RBAC engine — but the
 * server is the real boundary; this only hides controls/sections a role can't
 * use, so a missed gate just yields a 403 toast, never a data leak.
 */

const ALWAYS_GRANTED = new Set(['dashboard:view']);

export interface PermissionApi {
  /** True if the current user holds `perm` (super admin holds everything). */
  can: (perm: string) => boolean;
  /** True if any of `perms` is held. */
  canAny: (perms: string[]) => boolean;
  isSuperAdmin: boolean;
}

export function usePermissions(): PermissionApi {
  const currentUser = useAuthStore((s) => s.currentUser);

  return useMemo(() => {
    const isSuperAdmin = Boolean(currentUser?.isSuperAdmin);
    const perms = new Set(currentUser?.permissions ?? []);
    const can = (perm: string) => isSuperAdmin || ALWAYS_GRANTED.has(perm) || perms.has(perm);
    const canAny = (list: string[]) => list.some(can);
    return { can, canAny, isSuperAdmin };
  }, [currentUser]);
}
