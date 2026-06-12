import type { Deal } from '@/types';

/** Variables resolved per-recipient by the server at send time, so they are
 *  intentionally left in the body and must NOT be flagged as "unresolved". */
export const RECIPIENT_VARS = ['agentName', 'name'] as const;
const RECIPIENT_SET = new Set<string>(RECIPIENT_VARS);

const TOKEN_RE = /\{\{\s*(\w+)\s*\}\}/g;

const nzd = (n: number) =>
  new Intl.NumberFormat('en-NZ', {
    style: 'currency',
    currency: 'NZD',
    maximumFractionDigits: 0,
  }).format(n);

/** Build the variable map a linked deal can resolve in a template. Empty
 *  values are omitted so the token is left intact rather than blanked out. */
export function dealVariables(deal: Deal | undefined): Record<string, string> {
  if (!deal) return {};
  const suburbs = deal.preferredSuburbs.filter(Boolean).join(', ');
  const raw: Record<string, string> = {
    clientName: deal.clientName,
    budget: deal.budget > 0 ? nzd(deal.budget) : '',
    propertyType: deal.propertyType,
    bedrooms: deal.bedrooms ? String(deal.bedrooms) : '',
    bathrooms: deal.bathrooms ? String(deal.bathrooms) : '',
    suburb: suburbs,
    suburbs,
    requirements: deal.brief,
  };
  return Object.fromEntries(Object.entries(raw).filter(([, v]) => v && v.trim()));
}

/** Replace `{{token}}` from the map; tokens not in the map are left intact. */
export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(TOKEN_RE, (match, key: string) =>
    vars[key] !== undefined ? vars[key] : match,
  );
}

/** Distinct tokens still present, excluding ones the server fills per recipient. */
export function unresolvedVariables(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(TOKEN_RE)) {
    if (!RECIPIENT_SET.has(m[1])) found.add(m[1]);
  }
  return [...found];
}

/** Whether the text still references a per-recipient token (e.g. {{agentName}}). */
export function hasRecipientVars(text: string): boolean {
  for (const m of text.matchAll(TOKEN_RE)) {
    if (RECIPIENT_SET.has(m[1])) return true;
  }
  return false;
}
