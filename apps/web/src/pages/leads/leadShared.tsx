import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useQualificationStagesStore } from '@/stores/qualificationStagesStore';
import { getStagePillClass, getStageDotClass } from '@/pages/SettingsPage';
import type { LeadStatus } from '@/types';

export type ViewMode = 'card' | 'list' | 'kanban';

export const STATUS_OPTIONS: LeadStatus[] = [
  'new', 'contacted', 'qualified', 'agreement_sent', 'active', 'won', 'lost',
];

export const LEAD_SOURCE_OPTIONS = [
  'Website', 'Word of Mouth', 'Facebook', 'Instagram', 'Google', 'LinkedIn',
  'Referral', 'Real Estate Agent', 'Open Home', 'Email Campaign', 'Phone Enquiry', 'Other',
];

export interface PropertyTypeOption {
  value: string;
  label: string;
  group: 'popular' | 'standard';
}

export const PROPERTY_TYPE_OPTIONS: PropertyTypeOption[] = [
  { value: 'House', label: 'House', group: 'popular' },
  { value: 'Apartment', label: 'Apartment', group: 'popular' },
  { value: 'Townhouse', label: 'Townhouse', group: 'popular' },
  { value: 'Unit', label: 'Unit', group: 'popular' },
  { value: 'Villa', label: 'Villa', group: 'standard' },
  { value: 'Terrace', label: 'Terrace', group: 'standard' },
  { value: 'Duplex', label: 'Duplex', group: 'standard' },
  { value: 'Semi-Detached', label: 'Semi-Detached', group: 'standard' },
  { value: 'Lifestyle / Rural', label: 'Lifestyle / Rural', group: 'standard' },
  { value: 'Section / Land', label: 'Section / Land', group: 'standard' },
  { value: 'Commercial', label: 'Commercial', group: 'standard' },
  { value: 'Other', label: 'Other (specify below)', group: 'standard' },
];

export const STATUS_STYLES: Record<LeadStatus, { pill: string; dot: string; column: string; header: string; dropZone: string }> = {
  new: { pill: 'bg-primary/10 text-primary', dot: 'bg-primary', column: 'border-t-primary/60', header: 'bg-primary/8', dropZone: 'ring-2 ring-primary/40 bg-primary/5' },
  contacted: { pill: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300', dot: 'bg-cyan-500', column: 'border-t-cyan-400', header: 'bg-cyan-50 dark:bg-cyan-900/10', dropZone: 'ring-2 ring-cyan-400/50 bg-cyan-50/60 dark:bg-cyan-900/10' },
  qualified: { pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300', dot: 'bg-violet-500', column: 'border-t-violet-400', header: 'bg-violet-50 dark:bg-violet-900/10', dropZone: 'ring-2 ring-violet-400/50 bg-violet-50/60 dark:bg-violet-900/10' },
  agreement_sent: { pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', dot: 'bg-amber-500', column: 'border-t-amber-400', header: 'bg-amber-50 dark:bg-amber-900/10', dropZone: 'ring-2 ring-amber-400/50 bg-amber-50/60 dark:bg-amber-900/10' },
  active: { pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', dot: 'bg-emerald-500', column: 'border-t-emerald-400', header: 'bg-emerald-50 dark:bg-emerald-900/10', dropZone: 'ring-2 ring-emerald-400/50 bg-emerald-50/60 dark:bg-emerald-900/10' },
  won: { pill: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', dot: 'bg-green-500', column: 'border-t-green-400', header: 'bg-green-50 dark:bg-green-900/10', dropZone: 'ring-2 ring-green-400/50 bg-green-50/60 dark:bg-green-900/10' },
  lost: { pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300', dot: 'bg-rose-500', column: 'border-t-rose-400', header: 'bg-rose-50 dark:bg-rose-900/10', dropZone: 'ring-2 ring-rose-400/50 bg-rose-50/60 dark:bg-rose-900/10' },
};

/** Compact pill showing a lead's qualification stage. */
export function QualStageBadge({ stageId }: { stageId: string }) {
  const stages = useQualificationStagesStore((s) => s.stages);
  const stage = useMemo(() => stages.find((s) => s.id === stageId), [stages, stageId]);
  if (!stage) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold', getStagePillClass(stage.color))}>
      <span className={cn('h-1 w-1 rounded-full shrink-0', getStageDotClass(stage.color))} />
      {stage.label}
    </span>
  );
}
