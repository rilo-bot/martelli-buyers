import { useEffect } from 'react';
import { toast } from 'sonner';
import { useLeadsStore } from '@/stores/leadsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useOffersStore } from '@/stores/offersStore';
import { useTasksStore } from '@/stores/tasksStore';
import { usePurchasesStore } from '@/stores/purchasesStore';
import { useUsersStore } from '@/stores/usersStore';
import { useRolesStore } from '@/stores/rolesStore';
import { useAuthStore } from '@/stores/authStore';
import { useClientsStore } from '@/stores/clientsStore';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useOffMarketStore } from '@/stores/offMarketStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useCommentsStore } from '@/stores/commentsStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import { useDueDiligenceStore } from '@/stores/dueDiligenceStore';
import { useAISummariesStore } from '@/stores/aiSummariesStore';
import { useEmailTemplatesStore } from '@/stores/emailTemplatesStore';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { useConfigStore } from '@/stores/configStore';
import { useXeroStore } from '@/stores/xeroStore';

/**
 * Load every server-backed store once, after authentication. Mounted inside the
 * authenticated shell so it never fires while signed out.
 */
export function useBootstrapData() {
  useEffect(() => {
    // Only fetch what the current role can actually view — otherwise every
    // gated resource would 403 on login (RBAC enforces `<module>:view`). A
    // `null` perm means the endpoint is open to any authenticated user.
    const u = useAuthStore.getState().currentUser;
    const can = (perm: string | null) =>
      perm === null || !!u?.isSuperAdmin || !!u?.permissions?.includes(perm);

    const gated: Array<[() => Promise<void>, string | null]> = [
      [useConfigStore.getState().fetch, null],
      [useUsersStore.getState().fetch, null],
      [useXeroStore.getState().fetchStatus, null],
      [useLeadsStore.getState().fetch, 'leads:view'],
      [useDealsStore.getState().fetch, 'journeys:view'],
      [useOffersStore.getState().fetch, 'journeys:view'],
      [useTasksStore.getState().fetch, 'journeys:view'],
      [usePurchasesStore.getState().fetch, 'journeys:view'],
      [useCommentsStore.getState().fetch, 'journeys:view'],
      [useAISummariesStore.getState().fetch, 'journeys:view'],
      [useClientsStore.getState().fetch, 'clients:view'],
      [usePropertiesStore.getState().fetch, 'properties:view'],
      [useOffMarketStore.getState().fetch, 'properties:view'],
      [useAgentsStore.getState().fetch, 'agents:view'],
      [useInvoicesStore.getState().fetch, 'invoices:view'],
      [useDueDiligenceStore.getState().fetch, 'dueDiligence:view'],
      [useEmailTemplatesStore.getState().fetch, 'emails:view'],
      [useQualificationStagesStore.getState().fetch, 'settings:view'],
      [useRolesStore.getState().fetch, 'team:view'],
    ];
    const fetchers = gated.filter(([, perm]) => can(perm)).map(([f]) => f);

    Promise.all(fetchers.map((f) => f()))
      .then(() => {
        // First-run convenience: seed the sample email templates (this used to
        // happen on signup, which no longer exists). Runs only after the fetch
        // resolves (so the store's empty-guard is accurate) and only for users
        // who can both view and create templates.
        if (can('emails:view') && can('emails:create')) {
          useEmailTemplatesStore.getState().seedDefaultTemplates().catch(() => {});
        }
      })
      .catch(() => {
        toast.error('Failed to load some data. Please refresh.');
      });
  }, []);
}
