import { useClientsStore } from '@/stores/clientsStore';
import { useDealsStore } from '@/stores/dealsStore';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useLeadsStore } from '@/stores/leadsStore';
import { useAgentsStore } from '@/stores/agentsStore';
import { useInvoicesStore } from '@/stores/invoicesStore';
import type { DocumentCategory, DocumentEntityType } from '@/types';

/* ───────────────────────── categories ───────────────────────── */

export const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  agreement: 'Agreement',
  invoice: 'Invoice',
  dd_report: 'DD report',
  id_verification: 'ID verification',
  lim: 'LIM',
  building_report: 'Building report',
  contract: 'Contract',
  photo: 'Photo',
  other: 'Other',
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [DocumentCategory, string][];

/** Human label for a document category ('' → Uncategorised). */
export function categoryLabel(category: DocumentCategory | ''): string {
  return category ? CATEGORY_LABELS[category] : 'Uncategorised';
}

/* ───────────────────────── entity links ─────────────────────── */

/** Display label for an entity type (incl. the unlinked '' case). */
export const ENTITY_TYPE_LABELS: Record<DocumentEntityType | '', string> = {
  '': 'Not attached',
  client: 'Client',
  deal: 'Buyer journey',
  property: 'Property',
  lead: 'Lead',
  agent: 'Agent',
  invoice: 'Invoice',
  offer: 'Offer',
  dueDiligence: 'Due diligence',
  other: 'Other',
};

/** Entity types a document can be attached to from the picker (those with a browsable list). */
export const ATTACHABLE_TYPES: DocumentEntityType[] = ['client', 'deal', 'property', 'lead', 'agent', 'invoice'];

export interface EntityOption {
  id: string;
  label: string;
}

export interface EntityCatalogEntry {
  label: string;
  items: EntityOption[];
  /** Route to the record's detail/list view, if one exists. */
  to?: (id: string) => string;
}

/**
 * Reads every attachable store and returns, per entity type, its label, a
 * browsable {id,label} list, and (where a detail route exists) a link builder.
 * Used by the entity picker and to resolve "attached to" labels in the library.
 */
export function useEntityCatalog(): Record<DocumentEntityType, EntityCatalogEntry> {
  const clients = useClientsStore((s) => s.clients);
  const deals = useDealsStore((s) => s.deals);
  const properties = usePropertiesStore((s) => s.properties);
  const leads = useLeadsStore((s) => s.leads);
  const agents = useAgentsStore((s) => s.agents);
  const invoices = useInvoicesStore((s) => s.invoices);

  const fullName = (first: string, last: string) => `${first} ${last}`.trim() || 'Unnamed';

  return {
    client: {
      label: 'Client',
      to: (id) => `/clients/${id}`,
      items: clients.map((c) => ({ id: c.id, label: fullName(c.firstName, c.lastName) })),
    },
    deal: {
      label: 'Buyer journey',
      to: (id) => `/journeys/${id}`,
      items: deals.map((d) => ({ id: d.id, label: d.clientName || 'Buyer journey' })),
    },
    property: {
      label: 'Property',
      to: (id) => `/properties/${id}`,
      items: properties.map((p) => ({ id: p.id, label: p.address || 'Property' })),
    },
    lead: {
      label: 'Lead',
      to: (id) => `/leads/${id}`,
      items: leads.map((l) => ({ id: l.id, label: fullName(l.firstName, l.lastName) })),
    },
    agent: {
      label: 'Agent',
      to: () => '/agents',
      items: agents.map((a) => ({ id: a.id, label: `${fullName(a.firstName, a.lastName)}${a.agency ? ` · ${a.agency}` : ''}` })),
    },
    invoice: {
      label: 'Invoice',
      to: () => '/invoices',
      items: invoices.map((i) => ({ id: i.id, label: i.invoiceNumber || `Invoice ${i.id.slice(-5)}` })),
    },
    offer: { label: 'Offer', items: [] },
    dueDiligence: { label: 'Due diligence', items: [] },
    other: { label: 'Other', items: [] },
  };
}

/** A resolved attachment: what the document is linked to, and where to open it. */
export interface ResolvedAttachment {
  typeLabel: string;
  name: string;
  to?: string;
}

/** Resolve a document's entity link into a label + optional route. null when unlinked. */
export function resolveAttachment(
  catalog: Record<DocumentEntityType, EntityCatalogEntry>,
  entityType: DocumentEntityType | '',
  entityId: string,
): ResolvedAttachment | null {
  if (!entityType || !entityId) return null;
  const entry = catalog[entityType];
  const typeLabel = ENTITY_TYPE_LABELS[entityType] ?? entityType;
  const match = entry?.items.find((it) => it.id === entityId);
  return {
    typeLabel,
    name: match?.label ?? 'Unknown record',
    to: match && entry?.to ? entry.to(entityId) : undefined,
  };
}

/* ───────────────────────── file helpers ─────────────────────── */

/** Human-readable byte size (e.g. "2.4 MB"). */
export function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  return `${n >= 10 || u === 0 ? Math.round(n) : n.toFixed(1)} ${units[u]}`;
}

/** Coarse file kind from a MIME type, for icon/label choice. */
export function fileKind(mimeType: string): 'image' | 'pdf' | 'doc' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'doc';
}
