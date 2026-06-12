import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QualStageBadge, STATUS_STYLES } from './leadShared';
import type { Lead } from '@/types';

interface LeadsTableProps {
  leads: Lead[];
  selectedIds: string[];
  onSelectedChange: (ids: string[]) => void;
  density: 'comfortable' | 'compact';
  onMarkWon: (id: string) => void;
}

export function LeadsTable({ leads, selectedIds, onSelectedChange, density, onMarkWon }: LeadsTableProps) {
  const navigate = useNavigate();

  const columns: Column<Lead>[] = [
    {
      key: 'name',
      header: 'Contact',
      sortValue: (l) => `${l.lastName} ${l.firstName}`.toLowerCase(),
      cell: (l) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
            {l.firstName?.[0]}{l.lastName?.[0]}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{l.firstName} {l.lastName}</p>
            <p className="text-xs text-muted-foreground truncate">{l.source || 'Direct enquiry'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      sortValue: (l) => l.email.toLowerCase(),
      cell: (l) => <span className="text-xs text-muted-foreground">{l.email}</span>,
    },
    {
      key: 'budget',
      header: 'Budget',
      align: 'right',
      sortValue: (l) => l.budget,
      cell: (l) => <span className="text-sm font-medium tabular-nums">${l.budget.toLocaleString()}</span>,
    },
    {
      key: 'property',
      header: 'Property',
      cell: (l) => (
        <div className="text-xs text-muted-foreground">
          <div>{l.propertyType || '—'}</div>
          {(l.bedrooms || l.bathrooms) ? <div>{l.bedrooms || 0}bd · {l.bathrooms || 0}ba</div> : null}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (l) => l.status,
      cell: (l) => {
        const style = STATUS_STYLES[l.status];
        return (
          <span className={cn('inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-semibold w-fit capitalize', style.pill)}>
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', style.dot)} />
            {l.status.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      key: 'stage',
      header: 'Qual. Stage',
      cell: (l) => (l.qualificationStageId ? <QualStageBadge stageId={l.qualificationStageId} /> : <span className="text-xs text-muted-foreground">—</span>),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      cell: (l) =>
        l.status !== 'won' && l.status !== 'lost' ? (
          <Button
            size="sm"
            onClick={(e) => { e.stopPropagation(); onMarkWon(l.id); }}
            className="h-7 px-3 text-xs"
          >
            <Trophy className="mr-1 h-3 w-3" /> Won
          </Button>
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={leads}
      getRowId={(l) => l.id}
      onRowClick={(l) => navigate(`/leads/${l.id}`)}
      selectable
      selectedIds={selectedIds}
      onSelectedChange={onSelectedChange}
      density={density}
      initialSort={{ key: 'name', dir: 'asc' }}
      empty="No leads match your filters."
    />
  );
}
