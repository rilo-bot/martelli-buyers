import type { DealStage, PropertyStatus } from '@/types';

// ---------------------------------------------------------------------------
// Single source of truth for stage/status labels + pill colours, so the same
// status renders identically across the Deals, Property and Client pages.
// ---------------------------------------------------------------------------

export const DEAL_STAGE_ORDER: DealStage[] = [
  'qualification', 'search', 'shortlisting', 'due_diligence', 'offer', 'settlement', 'complete',
];

export const STAGE_LABELS: Record<DealStage, string> = {
  qualification: 'Qualification',
  search: 'Search',
  shortlisting: 'Shortlisting',
  due_diligence: 'Due Diligence',
  offer: 'Offer',
  settlement: 'Settlement',
  complete: 'Complete',
};

/** Soft tinted pill (with border) for a deal stage. */
export const STAGE_PILL: Record<DealStage, string> = {
  qualification: 'bg-primary/10 text-primary border-primary/20',
  search: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  shortlisting: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  due_diligence: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  offer: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  settlement: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  complete: 'bg-muted text-muted-foreground border-border',
};

/** Solid accent for the stage mini-bars. */
export const STAGE_BAR_ACCENT: Record<DealStage, string> = {
  qualification: 'bg-primary',
  search: 'bg-violet-500',
  shortlisting: 'bg-amber-500',
  due_diligence: 'bg-orange-500',
  offer: 'bg-rose-500',
  settlement: 'bg-emerald-500',
  complete: 'bg-muted-foreground',
};

export const PROPERTY_STATUS_ORDER: PropertyStatus[] = [
  'suggested', 'interested', 'viewed', 'shortlisted', 'rejected', 'offer_placed', 'purchased',
];

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  suggested: 'Suggested',
  interested: 'Interested',
  viewed: 'Viewed',
  shortlisted: 'Shortlisted',
  rejected: 'Rejected',
  offer_placed: 'Offer Placed',
  purchased: 'Purchased',
};

/** Soft tinted pill (with border) for a property status. */
export const PROPERTY_STATUS_PILL: Record<PropertyStatus, string> = {
  suggested: 'bg-primary/10 text-primary border-primary/25',
  interested: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/25',
  viewed: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25',
  shortlisted: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/25',
  rejected: 'bg-muted text-muted-foreground border-border',
  offer_placed: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/25',
  purchased: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/25',
};

/** Solid dot accent matching each property status pill. */
export const PROPERTY_STATUS_DOT: Record<PropertyStatus, string> = {
  suggested: 'bg-primary',
  interested: 'bg-cyan-500',
  viewed: 'bg-amber-500',
  shortlisted: 'bg-violet-500',
  rejected: 'bg-muted-foreground',
  offer_placed: 'bg-orange-500',
  purchased: 'bg-emerald-500',
};
