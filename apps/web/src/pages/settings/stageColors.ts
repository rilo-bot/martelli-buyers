// Shared stage colour palette + helpers. Kept in its own module so both the
// Settings UI and the Leads pages can import without a circular page dep.
// (SettingsPage re-exports getStagePillClass/getStageDotClass for back-compat.)

import type { LeadStatus } from '@/types';

export const STAGE_COLORS = [
  { value: 'cyan', label: 'Cyan', dot: 'bg-cyan-500', pill: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  { value: 'violet', label: 'Violet', dot: 'bg-violet-500', pill: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { value: 'amber', label: 'Amber', dot: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'emerald', label: 'Emerald', dot: 'bg-emerald-500', pill: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'rose', label: 'Rose', dot: 'bg-rose-500', pill: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  { value: 'primary', label: 'Brand', dot: 'bg-primary', pill: 'bg-primary/10 text-primary' },
  { value: 'orange', label: 'Orange', dot: 'bg-orange-500', pill: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { value: 'sky', label: 'Sky', dot: 'bg-sky-500', pill: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
];

export function getStagePillClass(color: string): string {
  return STAGE_COLORS.find((c) => c.value === color)?.pill ?? 'bg-muted text-muted-foreground';
}

export function getStageDotClass(color: string): string {
  return STAGE_COLORS.find((c) => c.value === color)?.dot ?? 'bg-muted-foreground';
}

export const BLANK_STAGE_FORM: { label: string; description: string; color: string; linkedStatus: LeadStatus | '' } = {
  label: '', description: '', color: 'cyan', linkedStatus: '',
};
export const BLANK_CHECKLIST_FORM = { label: '', description: '', required: true };
