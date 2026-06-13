import { Navigate } from 'react-router-dom';
import { usePermissions } from '@/lib/permissions';

/**
 * Route guard: renders children only if the current user holds `perm`,
 * otherwise redirects to the dashboard. The server still enforces independently.
 */
export function RequirePermission({ perm, children }: { perm: string; children: React.ReactNode }) {
  const { can } = usePermissions();
  if (!can(perm)) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}
