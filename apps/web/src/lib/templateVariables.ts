/**
 * Catalog of the `{{placeholder}}` tokens supported in email subjects/bodies,
 * plus helpers that turn a record's resolved values into the grouped, labelled
 * model the rich-editor's "Insert placeholder" menu renders.
 *
 * Two views are produced from the same catalog:
 *  - {@link catalogPlaceholderGroups} — for *authoring* a reusable template
 *    (no record in context): every token grouped by topic, inserts `{{token}}`.
 *  - {@link composePlaceholderGroups} — for *composing* against a record: tokens
 *    that resolve from the record show their live value and insert that value;
 *    tokens filled per recipient (e.g. an agent blast) are flagged; the rest are
 *    listed as manual placeholders.
 */

/** One insertable item shown in the editor's placeholder menu. */
export interface EditorPlaceholder {
  /** Human label, e.g. "Client name". */
  label: string;
  /** The raw token, e.g. "{{clientName}}" — shown as a mono hint. */
  token: string;
  /** Text inserted into the document: a resolved value, or the token itself. */
  insert: string;
  /** Live resolved value from the current record, when available. */
  value?: string;
  /** Short hint shown for per-recipient / manual placeholders. */
  hint?: string;
}

export interface EditorPlaceholderGroup {
  label: string;
  items: EditorPlaceholder[];
}

type CatalogGroup =
  | 'Recipient'
  | 'Sender'
  | 'Client'
  | 'Property & search'
  | 'Agents & contacts'
  | 'Invoice'
  | 'Dates';

interface VariableDef {
  key: string;
  label: string;
  group: CatalogGroup;
  description: string;
}

/** Every supported token. The single source of truth for labels + grouping. */
export const TEMPLATE_VARIABLE_CATALOG: VariableDef[] = [
  // Recipient — resolved from the chosen recipient (or per-recipient on a blast).
  { key: 'agentName', label: 'Agent name', group: 'Recipient', description: "Recipient agent's name — filled per recipient on a blast" },
  { key: 'name', label: 'Recipient name', group: 'Recipient', description: "The recipient's name" },

  // Sender.
  { key: 'consultantName', label: 'Consultant name', group: 'Sender', description: 'The Martelli consultant sending the email' },

  // Client.
  { key: 'clientName', label: 'Client name', group: 'Client', description: "Client's full name" },
  { key: 'clientEmail', label: 'Client email', group: 'Client', description: "Client's email address" },
  { key: 'referrerName', label: 'Referrer name', group: 'Client', description: 'Who referred the client' },

  // Property & search.
  { key: 'budget', label: 'Budget', group: 'Property & search', description: "Client's search budget" },
  { key: 'propertyType', label: 'Property type', group: 'Property & search', description: 'Type of property sought' },
  { key: 'bedrooms', label: 'Bedrooms', group: 'Property & search', description: 'Required bedrooms' },
  { key: 'bathrooms', label: 'Bathrooms', group: 'Property & search', description: 'Required bathrooms' },
  { key: 'suburb', label: 'Suburb', group: 'Property & search', description: 'Preferred suburb(s)' },
  { key: 'suburbs', label: 'Suburbs', group: 'Property & search', description: 'Preferred suburbs' },
  { key: 'requirements', label: 'Requirements', group: 'Property & search', description: 'Key search brief' },
  { key: 'propertyAddress', label: 'Property address', group: 'Property & search', description: 'Address of the subject property' },
  { key: 'priceGuide', label: 'Price guide', group: 'Property & search', description: 'Price guide for the property' },
  { key: 'propertyCount', label: 'Property count', group: 'Property & search', description: 'Number of properties reviewed' },
  { key: 'propertyList', label: 'Property list', group: 'Property & search', description: 'List of shortlisted properties' },
  { key: 'propertiesReviewed', label: 'Properties reviewed', group: 'Property & search', description: 'Count reviewed this week' },
  { key: 'propertiesShortlisted', label: 'Properties shortlisted', group: 'Property & search', description: 'Count shortlisted' },
  { key: 'upcomingInspections', label: 'Upcoming inspections', group: 'Property & search', description: 'Inspections scheduled next' },
  { key: 'inspectionNotes', label: 'Inspection notes', group: 'Property & search', description: 'Notes from the inspection' },
  { key: 'ddSummary', label: 'DD summary', group: 'Property & search', description: 'Due-diligence key findings' },

  // Agents & contacts.
  { key: 'inspectionAgent', label: 'Inspecting agent', group: 'Agents & contacts', description: 'Agent conducting the inspection' },
  { key: 'agentPhone', label: 'Agent phone', group: 'Agents & contacts', description: "Agent's phone number" },
  { key: 'agentContacts', label: 'Agent contacts', group: 'Agents & contacts', description: 'Number of agent contacts made' },
  { key: 'agentCount', label: 'Agent count', group: 'Agents & contacts', description: 'Size of the agent network contacted' },
  { key: 'lawyerName', label: 'Lawyer name', group: 'Agents & contacts', description: "Client's lawyer" },
  { key: 'brokerName', label: 'Broker name', group: 'Agents & contacts', description: "Client's mortgage broker" },

  // Invoice.
  { key: 'invoiceNumber', label: 'Invoice number', group: 'Invoice', description: 'Invoice reference' },
  { key: 'amount', label: 'Amount', group: 'Invoice', description: 'Invoice amount' },
  { key: 'purchasePrice', label: 'Purchase price', group: 'Invoice', description: 'Agreed purchase price' },
  { key: 'offerPrice', label: 'Offer price', group: 'Invoice', description: 'Offer amount' },
  { key: 'settlementAmount', label: 'Settlement amount', group: 'Invoice', description: 'Amount due at settlement' },
  { key: 'milestoneName', label: 'Milestone name', group: 'Invoice', description: 'Milestone being invoiced' },
  { key: 'conditions', label: 'Conditions', group: 'Invoice', description: 'Offer conditions' },
  { key: 'settlement', label: 'Settlement terms', group: 'Invoice', description: 'Settlement terms' },

  // Dates.
  { key: 'callDay', label: 'Call day', group: 'Dates', description: 'Proposed discovery-call day' },
  { key: 'date', label: 'Date', group: 'Dates', description: "Today's / the update date" },
  { key: 'dueDate', label: 'Due date', group: 'Dates', description: 'Invoice due date' },
  { key: 'agreementDate', label: 'Agreement date', group: 'Dates', description: 'Date the agency agreement was signed' },
  { key: 'inspectionDate', label: 'Inspection date', group: 'Dates', description: 'Date of the inspection' },
  { key: 'inspectionTime', label: 'Inspection time', group: 'Dates', description: 'Time of the inspection' },
  { key: 'contractDate', label: 'Contract date', group: 'Dates', description: 'Contract date' },
  { key: 'exchangeDate', label: 'Exchange date', group: 'Dates', description: 'Date contracts were exchanged' },
  { key: 'coolingOffDate', label: 'Cooling-off end', group: 'Dates', description: 'End of the cooling-off period' },
  { key: 'settlementDate', label: 'Settlement date', group: 'Dates', description: 'Settlement date' },
  { key: 'weekNumber', label: 'Week number', group: 'Dates', description: 'Search week number' },
];

const CATALOG_BY_KEY = new Map(TEMPLATE_VARIABLE_CATALOG.map((d) => [d.key, d]));

// Preserves catalog declaration order when grouping.
const GROUP_ORDER: CatalogGroup[] = [
  'Recipient', 'Sender', 'Client', 'Property & search', 'Agents & contacts', 'Invoice', 'Dates',
];

/**
 * Authoring view: the whole catalog grouped by topic. Inserts the `{{token}}`
 * so the template stays reusable. Used where no record is in context.
 */
export function catalogPlaceholderGroups(): EditorPlaceholderGroup[] {
  return GROUP_ORDER.map((group) => ({
    label: group,
    items: TEMPLATE_VARIABLE_CATALOG.filter((d) => d.group === group).map((d) => ({
      label: d.label,
      token: `{{${d.key}}}`,
      insert: `{{${d.key}}}`,
      hint: d.description,
    })),
  })).filter((g) => g.items.length > 0);
}

const labelFor = (key: string): string => CATALOG_BY_KEY.get(key)?.label ?? key;

/**
 * Compose view: tokens that resolve from `values` show their live value and
 * insert it directly (so the composed email reads as final text, not a token);
 * keys in `perRecipientKeys` are flagged as filled per recipient and insert the
 * token; every remaining catalog token is offered as a manual placeholder.
 */
export function composePlaceholderGroups(
  values: Record<string, string>,
  perRecipientKeys: string[] = [],
): EditorPlaceholderGroup[] {
  const perSet = new Set(perRecipientKeys);
  const fromRecord: EditorPlaceholder[] = [];
  const perRecipient: EditorPlaceholder[] = [];
  const manual: EditorPlaceholder[] = [];

  const seen = new Set<string>();
  for (const def of TEMPLATE_VARIABLE_CATALOG) {
    seen.add(def.key);
    const token = `{{${def.key}}}`;
    const val = values[def.key];
    if (perSet.has(def.key)) {
      perRecipient.push({ label: def.label, token, insert: token, hint: 'filled per recipient' });
    } else if (val && val.trim()) {
      fromRecord.push({ label: def.label, token, insert: val, value: val });
    } else {
      manual.push({ label: def.label, token, insert: token, hint: def.description });
    }
  }

  // Surface any context values that aren't in the catalog (defensive).
  for (const [key, val] of Object.entries(values)) {
    if (seen.has(key) || perSet.has(key) || !val || !val.trim()) continue;
    fromRecord.push({ label: labelFor(key), token: `{{${key}}}`, insert: val, value: val });
  }

  const groups: EditorPlaceholderGroup[] = [];
  if (fromRecord.length) groups.push({ label: 'From this record', items: fromRecord });
  if (perRecipient.length) groups.push({ label: 'Filled per recipient', items: perRecipient });
  if (manual.length) groups.push({ label: 'Other placeholders', items: manual });
  return groups;
}
