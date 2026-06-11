import { useEffect } from 'react';
import { toast } from 'sonner';
import { useLeadsStore } from '@/stores/leadsStore';
import { useDealsStore } from '@/stores/dealsStore';
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

/**
 * Load every server-backed store once, after authentication. Mounted inside the
 * authenticated shell so it never fires while signed out.
 */
export function useBootstrapData() {
  useEffect(() => {
    const fetchers = [
      useLeadsStore.getState().fetch,
      useDealsStore.getState().fetch,
      useClientsStore.getState().fetch,
      usePropertiesStore.getState().fetch,
      useOffMarketStore.getState().fetch,
      useAgentsStore.getState().fetch,
      useCommentsStore.getState().fetch,
      useInvoicesStore.getState().fetch,
      useDueDiligenceStore.getState().fetch,
      useAISummariesStore.getState().fetch,
      useEmailTemplatesStore.getState().fetch,
      useQualificationStagesStore.getState().fetch,
    ];
    Promise.all(fetchers.map((f) => f())).catch(() => {
      toast.error('Failed to load some data. Please refresh.');
    });
  }, []);
}
