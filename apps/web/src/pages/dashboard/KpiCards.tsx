import { StatCard } from '@/components/ui/stat-card';
import { Stagger, StaggerItem } from '@/components/motion';
import type { KpiDatum } from './dashboardData';

export function KpiCards({ kpis }: { kpis: KpiDatum[] }) {
  return (
    <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" step={0.06}>
      {kpis.map((k) => (
        <StaggerItem key={k.key}>
          <StatCard
            label={k.label}
            value={k.value}
            format={k.format}
            icon={k.icon}
            spark={k.spark}
            delta={k.delta}
            deltaLabel={k.deltaLabel}
            to={k.to}
            size="lg"
          />
        </StaggerItem>
      ))}
    </Stagger>
  );
}
