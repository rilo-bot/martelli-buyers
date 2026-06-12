import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatusPill } from '@/components/ui/status-pill';
import { FadeInView } from '@/components/motion';
import { useDashboardData } from '@/pages/dashboard/dashboardData';
import { NeedsAttention } from '@/pages/dashboard/NeedsAttention';
import { KpiCards } from '@/pages/dashboard/KpiCards';
import { PipelineFunnel } from '@/pages/dashboard/PipelineFunnel';
import { RevenueChart } from '@/pages/dashboard/RevenueChart';
import { ActivityFeed } from '@/pages/dashboard/ActivityFeed';

export default function DashboardPage() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const { kpis, attention, funnel, revenue, activity } = useDashboardData();

  const now = new Date();
  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, [now]);
  const firstName = currentUser?.name?.split(' ')[0] ?? 'there';
  const dateLabel = now.toLocaleDateString('en-NZ', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <PageHeader
        title={<>{greeting}, {firstName}</>}
        subtitle={dateLabel}
        status={<StatusPill tone="live">Live</StatusPill>}
        actions={
          <>
            <Button asChild variant="outline" size="sm" className="h-9">
              <Link to="/leads?new=1"><Plus className="mr-1.5 h-3.5 w-3.5" />New Lead</Link>
            </Button>
            <Button asChild size="sm" className="h-9 shadow-sm">
              <Link to="/deals?new=1"><Plus className="mr-1.5 h-3.5 w-3.5" />New Campaign</Link>
            </Button>
          </>
        }
      />

      <NeedsAttention items={attention} />

      <KpiCards kpis={kpis} />

      <FadeInView className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <RevenueChart data={revenue} />
          <PipelineFunnel stages={funnel} />
        </div>
        <ActivityFeed items={activity} />
      </FadeInView>
    </div>
  );
}
