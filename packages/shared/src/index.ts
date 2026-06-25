/**
 * @rilo/shared — domain types shared between the Express API (apps/server)
 * and the web client (apps/web).
 *
 * NOTE on dates: the API serializes Mongo documents to JSON, so every date
 * field is an ISO **string** on the wire. Components parse with `new Date(x)`
 * before formatting.
 */

export type UserRole = 'admin' | 'staff' | 'client' | 'agent';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'agreement_sent' | 'active' | 'won' | 'lost';
export type DealStage = 'qualification' | 'search' | 'shortlisting' | 'due_diligence' | 'offer' | 'settlement' | 'complete';
export type PropertyStatus = 'suggested' | 'interested' | 'viewed' | 'shortlisted' | 'rejected' | 'offer_placed' | 'purchased';
/** Market availability of an off-market property in the central database. */
export type OffMarketStatus = 'available' | 'under_offer' | 'sold' | 'withdrawn' | 'archived';
export type AgentGeo = 'East' | 'West' | 'North' | 'Central';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export type EmailTemplateCategory = 'welcome' | 'dd_request' | 'status_update' | 'requirement_blast' | 'thank_you' | 'post_settlement' | 'other';
/** Who an email template is addressed to. Drives recipient pre-selection in the Send Email dialog. */
export type EmailRecipientType = 'client' | 'agent';
export type ChecklistItemStatus = 'pending' | 'completed' | 'na';
export type ConsentStatus = 'pending' | 'granted' | 'declined';
export type OfferStatus = 'draft' | 'submitted' | 'negotiating' | 'accepted' | 'declined' | 'withdrawn';
export type TaskType = 'call' | 'viewing' | 'lim' | 'builders_report' | 'finance' | 'agreement' | 'other';
export type TaskPriority = 'low' | 'normal' | 'high';
export type PurchaseStatus = 'pending' | 'unconditional' | 'settled';
/** The kind of record a Document is attached to (polymorphic link). '' / 'other' = unattached. */
export type DocumentEntityType = 'deal' | 'client' | 'property' | 'lead' | 'offer' | 'dueDiligence' | 'invoice' | 'agent' | 'other';
/** Coarse classification used to filter the document library. */
export type DocumentCategory = 'agreement' | 'invoice' | 'dd_report' | 'id_verification' | 'lim' | 'building_report' | 'contract' | 'photo' | 'other';

/* ───────────────────────── RBAC: permissions + roles ─────────────────────
 * Permissions are "<module>:<action>" strings. The catalog below is the single
 * source of truth shared by the Express API (enforcement) and the web client
 * (gating + the role-permission matrix editor).
 * ------------------------------------------------------------------------- */

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'send' | 'manage';
export type Permission = string; // `${moduleKey}:${PermissionAction}`

export interface PermissionModule {
  key: string;
  label: string;
  actions: PermissionAction[];
}

/** Module → available actions. Drives both enforcement and the matrix UI. */
export const PERMISSION_MODULES: PermissionModule[] = [
  { key: 'dashboard', label: 'Dashboard', actions: ['view'] },
  { key: 'leads', label: 'Leads', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'enquiries', label: 'Contact Enquiries', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'clients', label: 'Clients', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'journeys', label: 'Buyer Journeys', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'properties', label: 'Properties', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'invoices', label: 'Invoices', actions: ['view', 'create', 'edit', 'delete', 'send'] },
  { key: 'agents', label: 'Agents', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'emails', label: 'Emails', actions: ['view', 'create', 'edit', 'delete', 'send'] },
  { key: 'dueDiligence', label: 'Due Diligence', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'documents', label: 'Documents', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'meet', label: 'Meet', actions: ['view', 'create'] },
  { key: 'settings', label: 'Settings', actions: ['view', 'manage'] },
  { key: 'team', label: 'Team & Roles', actions: ['view', 'manage'] },
];

/* ──────────────────── Buyer-journey tab visibility ───────────────────────
 * Each tab on the Buyer Journey detail page can be shown or hidden per role.
 * The gating permissions are "journeyTab:<tabKey>" strings so they live in the
 * same role-permission matrix as every other permission — no separate system.
 * ------------------------------------------------------------------------- */

/** Module key under which the per-tab permissions are grouped. */
export const JOURNEY_TAB_MODULE_KEY = 'journeyTab';

export interface JourneyTabDef {
  /** Tab id used in the URL (?tab=) and as the permission suffix. */
  key: string;
  label: string;
}

/** Buyer-journey detail tabs, in display order. */
export const JOURNEY_TABS: JourneyTabDef[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'properties', label: 'Properties' },
  { key: 'offers', label: 'Offers' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'comparables', label: 'Comparables' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'purchase', label: 'Purchase' },
  { key: 'comments', label: 'Comments' },
  { key: 'ai', label: 'AI Summaries' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'emails', label: 'Emails' },
];

/** The permission string that gates a single journey tab. */
export const journeyTabPerm = (tabKey: string): Permission => `${JOURNEY_TAB_MODULE_KEY}:${tabKey}`;

/** Every journey-tab permission string (one per tab). */
export const ALL_JOURNEY_TAB_PERMISSIONS: Permission[] = JOURNEY_TABS.map((t) => journeyTabPerm(t.key));

/**
 * Which journey tabs a user may see, given a permission predicate.
 * Backward-compatible: a role that holds NONE of the tab permissions (e.g. one
 * created before per-tab gating existed) sees every tab — gating only takes
 * effect once at least one tab is explicitly granted to the role.
 */
export function visibleJourneyTabKeys(has: (perm: Permission) => boolean): Set<string> {
  const held = JOURNEY_TABS.filter((t) => has(journeyTabPerm(t.key))).map((t) => t.key);
  if (held.length === 0) return new Set(JOURNEY_TABS.map((t) => t.key));
  return new Set(held);
}

/** Flat list of every valid permission string. */
export const ALL_PERMISSIONS: Permission[] = [
  ...PERMISSION_MODULES.flatMap((m) => m.actions.map((a) => `${m.key}:${a}`)),
  ...ALL_JOURNEY_TAB_PERMISSIONS,
];

/** Always granted to any authenticated user, so a misconfigured role is never fully locked out. */
export const ALWAYS_GRANTED: Permission[] = ['dashboard:view'];

/** Built-in role keys. Custom roles are any other key. */
export const SYSTEM_ROLES = ['admin', 'manager', 'staff'] as const;
export type SystemRole = (typeof SYSTEM_ROLES)[number];

/**
 * Management hierarchy among the built-in roles: super admin > admin > manager > staff.
 * Higher rank = more authority. Custom (non-system) roles have no rank — they are
 * assigned/managed by the super admin only. Shared by server enforcement and UI gating.
 */
export const ROLE_RANK: Record<string, number> = { admin: 3, manager: 2, staff: 1 };

/** Hierarchy rank of a role key, or undefined for custom (non-system) roles. */
export function roleRank(roleKey: string): number | undefined {
  return ROLE_RANK[roleKey];
}

/**
 * May a requester act on a given role key — i.e. manage a user who holds it, or
 * assign it to someone? The super admin outranks everything; otherwise the
 * requester must hold a ranked system role and strictly outrank that key.
 * (So admin → manager/staff, manager → staff, and custom roles stay super-admin-only.)
 */
export function outranksRole(
  roleKey: string,
  requesterRole: string,
  requesterIsSuperAdmin: boolean,
): boolean {
  if (requesterIsSuperAdmin) return true;
  const rr = roleRank(requesterRole);
  const kr = roleRank(roleKey);
  return rr !== undefined && kr !== undefined && kr < rr;
}

/**
 * The built-in role with full administrative authority — top of the management
 * hierarchy below the super admin. Only the super admin may edit or delete it.
 */
export const ADMIN_ROLE_KEY = 'admin';

/**
 * May a requester who holds `team:manage` edit or delete the role `roleKey`?
 * The super admin can manage any role; a regular admin can manage every role
 * EXCEPT the built-in Admin role, so they can't alter (or escalate within) their
 * own tier. Shared by server enforcement (routes/roles.ts) and the Roles panel.
 */
export function canManageRole(roleKey: string, requesterIsSuperAdmin: boolean): boolean {
  return requesterIsSuperAdmin || roleKey !== ADMIN_ROLE_KEY;
}

const OPERATIONAL_FULL = ['leads', 'enquiries', 'clients', 'journeys', 'properties', 'agents', 'dueDiligence', 'documents'];

/** Default permission set per built-in role. Super admin always gets everything regardless. */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  manager: [
    'dashboard:view',
    ...OPERATIONAL_FULL.flatMap((m) => [`${m}:view`, `${m}:create`, `${m}:edit`, `${m}:delete`]),
    'invoices:view', 'invoices:create', 'invoices:edit', 'invoices:delete', 'invoices:send',
    'emails:view', 'emails:create', 'emails:edit', 'emails:delete', 'emails:send',
    'meet:view', 'meet:create',
    'settings:view',
    ...ALL_JOURNEY_TAB_PERMISSIONS,
  ],
  staff: [
    'dashboard:view',
    ...OPERATIONAL_FULL.flatMap((m) => [`${m}:view`, `${m}:create`, `${m}:edit`]),
    'invoices:view',
    'emails:view',
    'meet:view', 'meet:create',
    'settings:view',
    ...ALL_JOURNEY_TAB_PERMISSIONS,
  ],
};

/** A role definition (built-in or custom). */
export interface Role {
  id: string;
  key: string;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  /** Public URL of the user's profile photo; empty/absent → render initials. */
  avatarUrl?: string;
  /** Role key — references a Role.key (built-in or custom). */
  role: string;
  /** 'invited' until they accept the invite (or log in); then 'active'. */
  status?: 'invited' | 'active';
  createdAt: string;
  /** Effective permissions for the signed-in user. Populated on /me + verify-otp only. */
  permissions?: string[];
  /** True when this user matches SUPER_ADMIN_EMAIL. Populated on /me + verify-otp only. */
  isSuperAdmin?: boolean;
}

export interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  leadIds: string[];
  dealIds: string[];
  tags: string[];
  assignedTo: string;
  /** Linked Xero ContactID (empty until synced). */
  xeroContactId: string;
  /** ISO timestamp of the last successful push to Xero. */
  xeroSyncedAt: string;
  createdAt: string;
  updatedAt: string;
}

/* ───────────────────────── RILO Meet (external API) ──────────────────────
 * Video meetings created via the external RILO Meet API
 * (https://decoded-studios-api.onrender.com). The API key stays server-side;
 * the web client only ever talks to our `/api/meet` proxy. Shapes mirror the
 * RILO Meet integration contract — fields are optional/loose because they come
 * straight off an external service we don't control.
 * ------------------------------------------------------------------------- */

/** Lifecycle state of a RILO meeting. Loose union — unknown values pass through. */
export type MeetingStatus = 'live' | 'scheduled' | 'ended' | (string & {});

/** A meeting as returned by the RILO Meet API (via our proxy). */
export interface Meeting {
  meetingId: string;
  status: MeetingStatus;
  title?: string;
  hostEmail?: string;
  /** Shareable link participants open to join. */
  meetingLinkUrl?: string;
  /** Short human code embedded in the link. */
  meetingCode?: string;
  participants?: string[];
  /** ISO start time — present only for scheduled meetings. */
  scheduledStartAt?: string;
  scheduledDurationMinutes?: number;
  /** RILO Meet always flags externally-created meetings true. */
  isExternal?: boolean;
  createdAt?: string;
}

/** Payload for creating a meeting through the `/api/meet` proxy. */
export interface CreateMeetingInput {
  hostEmail: string;
  title: string;
  participants?: string[];
  /** Omit for an instant meeting; set for a scheduled one. */
  scheduledStartAt?: string;
  scheduledDurationMinutes?: number;
}

/** A single required checklist item that must be completed before a lead can advance past a stage */
export interface StageChecklistItem {
  id: string;
  label: string;
  description: string;
  required: boolean;
  order: number;
}

export interface QualificationStage {
  id: string;
  label: string;
  description: string;
  order: number;
  color: string;
  /** Checklist items required to complete this stage before advancing */
  checklistItems: StageChecklistItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Per-lead tracking of stage checklist completion.
 * Key = stageId, Value = set of completed StageChecklistItem ids
 */
export type LeadStageProgress = Record<string, string[]>;

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  source: string;
  status: LeadStatus;
  qualificationStageId: string;
  /** Per-stage checklist item completion for this lead */
  stageProgress: LeadStageProgress;
  notes: string;
  budget: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  preferredSuburbs: string[];
  assignedTo: string;
  clientId: string;
  // Buyer's agency agreement — authored, sent and e-signed during the lead phase
  // (signing a lead is what converts it to a client + buyer journey). On Won, the
  // signed agreement is carried over to the created deal for read-only reference.
  agreementStatus: 'pending' | 'sent' | 'signed';
  agreementUrl: string;
  agreementSignToken: string;
  agreementSentAt: string;
  agreementSignerName: string;
  agreementSignedAt: string;
  agreementSignerIp: string;
  agreementSignatureImage: string;
  /** Rich-HTML agreement body authored in the WYSIWYG editor ('' until seeded). */
  agreementBodyHtml: string;
  createdAt: string;
  updatedAt: string;
}

/** Lifecycle of a raw website contact enquiry before/at conversion to a Lead. */
export type ContactEnquiryStatus = 'new' | 'reviewed' | 'converted' | 'archived';

/**
 * A raw "Contact Us" form submission. Captured into its own collection (not the
 * Leads pipeline) so the public form can't flood qualified leads. Staff convert
 * the worthwhile ones into Leads, which stamps status 'converted' + convertedLeadId.
 */
export interface ContactEnquiry {
  id: string;
  name: string;
  email: string;
  phone: string;
  enquiryType: string;
  budget: string;
  location: string;
  message: string;
  consent: boolean;
  source: string;
  status: ContactEnquiryStatus;
  /** Set once converted — links to the created Lead. */
  convertedLeadId: string;
  assignedTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Deal {
  id: string;
  leadId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  stage: DealStage;
  brief: string;
  budget: number;
  fee: number;
  feeType: 'fixed' | 'percentage';
  preferredSuburbs: string[];
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  agreementStatus: 'pending' | 'sent' | 'signed';
  agreementUrl: string;
  agreementSignToken: string;
  agreementSentAt: string;
  agreementSignerName: string;
  agreementSignedAt: string;
  agreementSignerIp: string;
  agreementSignatureImage: string;
  agreementFeeText: string;
  agreementTermsText: string;
  agreementClauses: string;
  /** Rich-HTML agreement body authored in the WYSIWYG editor. '' = not yet
   *  migrated → the PDF falls back to the legacy PDFKit builder. Single source
   *  of truth once seeded. */
  agreementBodyHtml: string;
  invoiceIds: string[];
  assignedTo: string;
  aiConsentStatus: ConsentStatus;
  aiConsentDate: string;
  createdAt: string;
  updatedAt: string;
}

/** A merge field offered in the agreement editor and resolved at PDF build. */
export interface AgreementMergeField {
  /** Token id, e.g. 'clientName'. */
  token: string;
  /** Human label shown in the editor chip + as the unresolved placeholder. */
  label: string;
}

/**
 * Merge fields the agreement editor can insert as inline chips. The server
 * resolves each `token` against the deal/firm at PDF build; an unresolved token
 * renders as a visible `[label]` placeholder rather than a blank. Single source
 * of truth shared by the editor menu and the server resolver.
 */
export const AGREEMENT_MERGE_FIELDS: AgreementMergeField[] = [
  { token: 'clientName', label: 'Client name' },
  { token: 'clientEmail', label: 'Client email' },
  { token: 'clientPhone', label: 'Client phone' },
  { token: 'budget', label: 'Budget' },
  { token: 'propertyType', label: 'Property type' },
  { token: 'bedrooms', label: 'Bedrooms' },
  { token: 'bathrooms', label: 'Bathrooms' },
  { token: 'suburbs', label: 'Preferred suburbs' },
  { token: 'requirements', label: 'Requirements' },
  { token: 'firmName', label: 'Firm name' },
  { token: 'firmLicence', label: 'Firm licence' },
  { token: 'date', label: 'Today’s date' },
];

/** A recorded change on a Buyer Journey or its children, for the timeline + audit trail. */
export interface AuditEvent {
  id: string;
  entityType: string;
  entityId: string;
  dealId: string;
  action: string;
  field: string;
  fromValue: string;
  toValue: string;
  actorId: string;
  actorName: string;
  at: string;
  createdAt: string;
}

/** An offer placed on a property within a Buyer Journey (deal). */
export interface Offer {
  id: string;
  dealId: string;
  propertyId: string;
  amount: number;
  depositAmount: number;
  dateSubmitted: string;
  conditions: string;
  status: OfferStatus;
  counterOffer: number;
  outcome: string;
  fileUrls: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** A to-do on a Buyer Journey (call client, arrange viewing, request LIM, etc.). */
export interface Task {
  id: string;
  dealId: string;
  propertyId: string;
  title: string;
  type: TaskType;
  assignedTo: string;
  dueDate: string;
  completed: boolean;
  completedAt: string;
  priority: TaskPriority;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** The final purchase that closes a Buyer Journey. */
export interface Purchase {
  id: string;
  dealId: string;
  propertyId: string;
  purchasePrice: number;
  depositPaid: number;
  unconditionalDate: string;
  settlementDate: string;
  status: PurchaseStatus;
  solicitor: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Property {
  id: string;
  dealId: string;
  address: string;
  suburb: string;
  price: number;
  priceGuide: string;
  bedrooms: number;
  bathrooms: number;
  carparks: number;
  landSize: number;
  propertyType: string;
  status: PropertyStatus;
  notes: string;
  clientVisibleNotes: string;
  isClientVisible: boolean;
  agentId: string;
  sourceAgentName: string;
  listingUrl: string;
  photos: string[];
  isOffMarket: boolean;
  offMarketPropertyId: string;
  createdAt: string;
  updatedAt: string;
}

export interface OffMarketProperty {
  id: string;
  address: string;
  suburb: string;
  priceGuide: string;
  priceLow: number;
  priceHigh: number;
  bedrooms: number;
  bathrooms: number;
  carparks: number;
  propertyType: string;
  notes: string;
  sourceAgentId: string;
  sourceAgentName: string;
  attachments: string[];
  usedInDealIds: string[];
  status: OffMarketStatus;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  agency: string;
  geoTag: AgentGeo;
  suburbs: string[];
  isPreferred: boolean;
  notes: string;
  lastContactDate: string;
  dealsReferredIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  category: EmailTemplateCategory;
  /**
   * Intended audience for this template. Determines whether the Send Email
   * dialog pre-selects the client or an agent as recipient. Optional for
   * backwards-compatibility with templates seeded before this field existed —
   * use {@link emailTemplateAudience} to resolve the effective audience.
   */
  recipientType?: EmailRecipientType;
  subject: string;
  /** Plain-text body. Kept for the text/alt email part, card previews, and
   *  back-compat with templates authored before rich HTML existed. */
  body: string;
  /**
   * Rich HTML body authored in the WYSIWYG editor. Optional/empty for legacy
   * templates — fall back to {@link body} (rendered via the server's text→HTML
   * conversion). Always present on documents the server returns (schema default '').
   */
  bodyHtml?: string;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Resolve the effective audience of an email template. Falls back to inferring
 * from the category for legacy templates that predate the explicit
 * `recipientType` field (only `requirement_blast` is agent-directed).
 */
export function emailTemplateAudience(
  tpl: Pick<EmailTemplate, 'recipientType' | 'category'>,
): EmailRecipientType {
  if (tpl.recipientType) return tpl.recipientType;
  return tpl.category === 'requirement_blast' ? 'agent' : 'client';
}

export interface EmailCampaign {
  id: string;
  dealId: string;
  templateId: string;
  subject: string;
  body: string;
  /** Rich HTML body actually sent, when the blast used a rich template ('' = plain). */
  bodyHtml?: string;
  recipientType: 'agents' | 'client' | 'stakeholders';
  agentGeoFilter: AgentGeo[];
  preferredOnly: boolean;
  recipientCount: number;
  sentAt: string;
  status: 'draft' | 'sent';
  createdAt: string;
}

export interface Invoice {
  id: string;
  dealId: string;
  xeroInvoiceId: string;
  xeroStatus: string;
  xeroUrl: string;
  xeroLastSyncedAt: string;
  invoiceNumber: string;
  type: 'engagement' | 'milestone' | 'final';
  amount: number;
  gst: number;
  total: number;
  status: InvoiceStatus;
  dueDate: string;
  paidDate: string;
  description: string;
  /** ISO timestamp of the last reminder sent, and how many have been sent. */
  lastReminderAt: string;
  reminderCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DueDiligence {
  id: string;
  propertyId: string;
  dealId: string;
  address: string;
  floodMapUrl: string;
  floodMapNotes: string;
  naturalHazardsUrl: string;
  naturalHazardsNotes: string;
  councilRecordsUrl: string;
  evidenceLinks: EvidenceItem[];
  comparableSales: ComparableSale[];
  checklistItems: DDChecklistItem[];
  reportGenerated: boolean;
  reportUrl: string;
  internalNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface EvidenceItem {
  id: string;
  label: string;
  url: string;
  type: 'link' | 'screenshot' | 'document';
  addedAt: string;
}

export interface ComparableSale {
  id: string;
  address: string;
  suburb: string;
  salePrice: number;
  saleDate: string;
  bedrooms: number;
  bathrooms: number;
  landSize: number;
  notes: string;
  sourceUrl: string;
}

export interface DDChecklistItem {
  id: string;
  label: string;
  /** Group heading this item sits under (e.g. "Legalities"). '' = ungrouped. */
  section: string;
  status: ChecklistItemStatus;
  notes: string;
  completedBy: string;
  completedAt: string;
}

/**
 * One row of the org-wide Due Diligence audit-checklist template (configured in
 * Settings → Due Diligence). Admins choose which items appear by toggling
 * `enabled`; each new DD record snapshots the enabled items into its own
 * {@link DDChecklistItem} list, so editing the template never alters records
 * already created. Display order follows array order.
 */
export interface DDChecklistTemplateItem {
  id: string;
  label: string;
  /**
   * Group heading this item appears under in Settings and on DD records
   * (e.g. "Internal DD Requirements", "Legalities"). Items sharing a section
   * render together under one header. '' = ungrouped ("General"). Section order
   * follows the first appearance of each section name in array order.
   */
  section: string;
  /** When false the item is hidden — excluded from newly created DD records. */
  enabled: boolean;
}

export interface ClientComment {
  id: string;
  dealId: string;
  propertyId: string;
  authorId: string;
  authorName: string;
  authorRole: UserRole;
  content: string;
  attachments: CommentAttachment[];
  isClientVisible: boolean;
  createdAt: string;
}

export interface CommentAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
}

export interface AISummary {
  id: string;
  dealId: string;
  type: 'call' | 'meeting';
  title: string;
  date: string;
  participants: string[];
  summary: string;
  actionItems: ActionItem[];
  rawTranscript: string;
  isVisibleToClient: boolean;
  generatedAt: string;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  completed: boolean;
}

/**
 * A catalogued file. The bytes live in S3 (uploaded via /api/uploads/sign);
 * this record tracks its metadata and links it to any parent entity through the
 * polymorphic (entityType, entityId) pair. `dealId` is denormalised when known
 * so a whole Buyer Journey's documents can be listed in one query.
 */
export interface Document {
  id: string;
  /** Display name (defaults to the original filename). */
  name: string;
  description: string;
  /** Public URL the file is served from. */
  url: string;
  /** S3 object key — used to reclaim the file on delete. */
  storageKey: string;
  mimeType: string;
  /** Size in bytes (0 if unknown). */
  size: number;
  /** Optional classification; '' when the file is unclassified. */
  category: DocumentCategory | '';
  /** What this document is attached to. '' when unlinked. */
  entityType: DocumentEntityType | '';
  /** Id of the linked record (matches entityType). '' when unlinked. */
  entityId: string;
  /** Denormalised Buyer Journey id when the document belongs to one. */
  dealId: string;
  /** User id of the uploader. */
  uploadedBy: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReferralPartner {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  type: 'lawyer' | 'mortgage_broker' | 'financial_advisor' | 'other';
  notes: string;
  dealsReferredIds: string[];
  createdAt: string;
}

/** A synced Outlook email is either received (inbound) or sent (outbound). */
export type EmailDirection = 'inbound' | 'outbound';
/** Which Outlook folder a synced email came from. */
export type EmailFolder = 'inbox' | 'sent';
/** How an email got tagged to a client/deal. '' = not yet linked. */
export type EmailLinkSource = '' | 'auto' | 'manual';

export interface EmailAddress {
  name: string;
  address: string;
}

/** Attachment metadata only — bytes are streamed on demand from Graph. */
export interface EmailAttachment {
  graphId: string;
  name: string;
  size: number;
  contentType: string;
  isInline: boolean;
}

/**
 * An Outlook email pulled into the CRM and tagged against a client/deal.
 * Records originate from the background Microsoft Graph sync (keyed by graphId);
 * the UI lists + links them but never creates them by hand.
 */
export interface EmailMessage {
  id: string;
  graphId: string;
  internetMessageId: string;
  conversationId: string;
  subject: string;
  bodyPreview: string;
  bodyHtml: string;
  fromName: string;
  fromAddress: string;
  toRecipients: EmailAddress[];
  ccRecipients: EmailAddress[];
  sentAt: string;
  receivedAt: string;
  direction: EmailDirection;
  folder: EmailFolder;
  hasAttachments: boolean;
  attachments: EmailAttachment[];
  /** Linked client id (''=unlinked). */
  clientId: string;
  /** Linked Buyer Journey id (''=unlinked or client-only link). */
  dealId: string;
  linkSource: EmailLinkSource;
  linkedBy: string;
  linkedAt: string;
  createdAt: string;
  updatedAt: string;
}

/* ───────────────────────── company settings ──────────────────────────────
 * Admin-editable company identity, branding and invoice-template text. Stored
 * as a single org-wide document (the app is single-tenant) and consumed by the
 * PDF builders. Empty/unset fields fall back to COMPANY_SETTINGS_DEFAULTS so
 * output is unchanged until an admin customises it.
 * ------------------------------------------------------------------------- */

export interface CompanySettings {
  id: string;
  // Identity — shared by every generated PDF (invoice, agreement, DD report).
  firmName: string;
  firmAddress: string;
  firmLicence: string;
  /** GST/registration number shown on invoices ('' = omit). */
  gstNumber: string;
  /** Bank/payment details for invoice remittance ('' = omit). */
  bankDetails: string;
  // Branding.
  /** Accent colour as a #rrggbb hex string. Overrides the default azure. */
  brandColor: string;
  /** Logo as a base64 data URL (data:image/png|jpeg;base64,…); '' = text wordmark. */
  logoDataUrl: string;
  // Invoice template.
  invoiceTitle: string;
  invoicePaymentTerms: string;
  invoiceDefaultDescription: string;
  invoiceFooterText: string;
  /** GST percentage applied to new invoices and shown on the PDF. */
  gstRate: number;
  // Email branding — applied to outbound email (templates, sends, agent blasts).
  /**
   * Hosted (S3) logo URL shown in the email header. Distinct from
   * {@link logoDataUrl} (base64, for PDFs) because most email clients block or
   * strip base64 `<img>` — email needs a public URL. '' = firm-name wordmark.
   */
  emailLogoUrl: string;
  /** Org-wide signature block (sanitised rich HTML) appended to every email. '' = none. */
  emailSignatureHtml: string;
  /** Master switch for the branded email shell. When false, emails send unwrapped. */
  emailBrandingEnabled: boolean;
  /**
   * Org-wide Due Diligence audit-checklist template. The enabled items are
   * snapshotted into each new DD record's checklist. Defaults to
   * {@link DD_CHECKLIST_TEMPLATE_DEFAULTS} (all items enabled).
   */
  ddChecklistTemplate: DDChecklistTemplateItem[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Default Due Diligence audit-checklist template — the items every org starts
 * with, all enabled. Single source of truth for the Mongoose schema default,
 * the DD record builder's fallback, and the Settings "reset to defaults".
 */
export const DD_CHECKLIST_TEMPLATE_DEFAULTS: DDChecklistTemplateItem[] = [
  // Internal DD Requirements
  { id: 'dd-internal-1', section: 'Internal DD Requirements', label: 'AML for buyer cleared by lawyer in writing', enabled: true },
  { id: 'dd-internal-2', section: 'Internal DD Requirements', label: 'OIO for buyer confirmed by lawyer in writing', enabled: true },
  { id: 'dd-internal-3', section: 'Internal DD Requirements', label: 'Finance and AML cleared by bank/mortgage broker in writing (if applicable)', enabled: true },

  // Legalities
  { id: 'dd-legal-1', section: 'Legalities', label: 'Download and save the document pack. Share with buyer and lawyer. The pack should include S&P, LIM, title, any further disclosures or letters, and rental appraisal.', enabled: true },
  { id: 'dd-legal-2', section: 'Legalities', label: 'Check flats plan on Title (cross lease, Unit Title) for decks etc. Check for exclusive use areas incl car parking', enabled: true },
  { id: 'dd-legal-3', section: 'Legalities', label: 'Review LIM report - any outstanding consents or notes.', enabled: true },
  { id: 'dd-legal-4', section: 'Legalities', label: 'Buyers Agent review of LIM and Title, make general comments and recommendations, copying lawyer. Disclaimer on this email.', enabled: true },
  { id: 'dd-legal-5', section: 'Legalities', label: 'Legal advice letter received from lawyer relating to this property. Includes LIM, Title S&P review, and any Body Corporate Minutes. Save to file.', enabled: true },
  { id: 'dd-legal-6', section: 'Legalities', label: 'Council Files ordered and shared if required. Disclaimer required. Comment on these.', enabled: true },

  // S&P Agreement
  { id: 'dd-sp-1', section: 'S&P Agreement', label: 'Complete details including names (check its not in Trust), settlement date, deposit on unconditional date, price and', enabled: true },
  { id: 'dd-sp-2', section: 'S&P Agreement', label: 'Review chattels list. Edit as necessary.', enabled: true },
  { id: 'dd-sp-3', section: 'S&P Agreement', label: 'Ensure in writing that buyers understand 10% is payable, and confirm funds are availabe in NZD', enabled: true },
  { id: 'dd-sp-4', section: 'S&P Agreement', label: 'Confirm any variations to agreement in writitting. Confirm agreement with agent and their vendor.', enabled: true },
  { id: 'dd-sp-5', section: 'S&P Agreement', label: 'Confirm who will be present on auction day. If no parties, ensure signed bidding authority received and saved to file.', enabled: true },
  { id: 'dd-sp-6', section: 'S&P Agreement', label: 'Cover email outlining what the S&P includes and ensuring they have replied understanding the terms they are signing up for, copying lawyer.', enabled: true },

  // Insurance
  { id: 'dd-ins-1', section: 'Insurance', label: 'Confirm with agent the current insurance providor, and ideally annual premium', enabled: true },
  { id: 'dd-ins-2', section: 'Insurance', label: 'Request buyer obtains own independent quote, confirm', enabled: true },
  { id: 'dd-ins-3', section: 'Insurance', label: 'Send agent request of disclosure for any water penetration or insurance claims. Share with buyer and lawyer, save to file.', enabled: true },

  // Building Inspection
  { id: 'dd-build-1', section: 'Building Inspection', label: 'Recommended Building Inspector Options list sent to client', enabled: true },
  { id: 'dd-build-2', section: 'Building Inspection', label: 'Building inspection conducted.', enabled: true },
  { id: 'dd-build-3', section: 'Building Inspection', label: 'Building inspection written report received and saved to file. Special note regarding Weatherside, asbestos, monolithic or fibre cement', enabled: true },
  { id: 'dd-build-4', section: 'Building Inspection', label: 'Building inspection reviewed by buyer, broker, lawyer and bank (if required)', enabled: true },
  { id: 'dd-build-5', section: 'Building Inspection', label: 'Further consultants discussed and booked (if required)', enabled: true },

  // Local Government Websites (included in Summary Email)
  { id: 'dd-gov-1', section: 'Local Government Websites (included in Summary Email)', label: 'Auckland Flood Tracker check and details shared with buyers', enabled: true },
  { id: 'dd-gov-2', section: 'Local Government Websites (included in Summary Email)', label: 'Natural Hazards Portal address check and details shared with buyers', enabled: true },
  { id: 'dd-gov-3', section: 'Local Government Websites (included in Summary Email)', label: 'Auckland Council Unitary Plan check and details shared with buyers.', enabled: true },
  { id: 'dd-gov-4', section: 'Local Government Websites (included in Summary Email)', label: 'Disclaimer included in email for all three local websites, copying lawyer', enabled: true },

  // Ownership and Area (Included in Summary Email)
  { id: 'dd-own-1', section: 'Ownership and Area (Included in Summary Email)', label: 'Confirm details of the vendors and check their other ownership. Treat this sensitively as private details.', enabled: true },
  { id: 'dd-own-2', section: 'Ownership and Area (Included in Summary Email)', label: 'Check road and immediate neighbouring roads for Housing New Zealand, or any distinctive names like CORT Housing', enabled: true },
  { id: 'dd-own-3', section: 'Ownership and Area (Included in Summary Email)', label: 'Check the immediate neighbour ownership and any building consents recorded on CoreLogic', enabled: true },
  { id: 'dd-own-4', section: 'Ownership and Area (Included in Summary Email)', label: 'Check for any nearby ownership that has development potential, or owned by a group that reads as a developer', enabled: true },
  { id: 'dd-own-5', section: 'Ownership and Area (Included in Summary Email)', label: 'If there is a café, bar, bar or restaurant nearby, check their license hours and opening hours', enabled: true },
  { id: 'dd-own-6', section: 'Ownership and Area (Included in Summary Email)', label: 'Check for view shafts and protected or borrowed views, check risks to these.', enabled: true },

  // Comparable Sales (Included in Summary Email)
  { id: 'dd-comp-1', section: 'Comparable Sales (Included in Summary Email)', label: 'Outline details of the size of the property, tenure and address.', enabled: true },
  { id: 'dd-comp-2', section: 'Comparable Sales (Included in Summary Email)', label: 'Source minimum 3 comprable sales, outlining why they are comparable', enabled: true },
  { id: 'dd-comp-3', section: 'Comparable Sales (Included in Summary Email)', label: 'Provide a suggested price range for the buyers. Include agents online price bands.', enabled: true },

  // Finance
  { id: 'dd-fin-1', section: 'Finance', label: 'Share S&P with buyer and mortgage broker, asking them to share with bank for approval. Confirm timeframe.', enabled: true },
  { id: 'dd-fin-2', section: 'Finance', label: 'Confirm in writting that the bank is satisfied with the S&P', enabled: true },
  { id: 'dd-fin-3', section: 'Finance', label: 'Confirm with broker or bank maximum budget range for this property', enabled: true },

  // Rental
  { id: 'dd-rent-1', section: 'Rental', label: 'Share details of Tenancies NZ live data website for specific suburb', enabled: true },
  { id: 'dd-rent-2', section: 'Rental', label: 'Share current rental appraisal generated by agency. Confirm how water is metered.', enabled: true },
  { id: 'dd-rent-3', section: 'Rental', label: 'Request details of current HH certificate, or conduct HH assessment for client (e.g Panda)', enabled: true },
  { id: 'dd-rent-4', section: 'Rental', label: 'Request copies of marketing photos from the sales agent for rental listing purposes', enabled: true },
  { id: 'dd-rent-5', section: 'Rental', label: 'Request two viewing times for rental open homes prior to settlement (can be difficult)', enabled: true },

  // Swimming Pools and Spas
  { id: 'dd-pool-1', section: 'Swimming Pools and Spas', label: 'Confirm with the agent pool heating system, water type, cover, and service history', enabled: true },
  { id: 'dd-pool-2', section: 'Swimming Pools and Spas', label: 'Sauna / spa - confirm these are in working order, water type, and service history', enabled: true },
  { id: 'dd-pool-3', section: 'Swimming Pools and Spas', label: 'Check when the last Council Inspection was, and that it was compliant. Speak to the building inspector about checking that the fencing and gates are compliant.', enabled: true },

  // General/Other
  { id: 'dd-gen-1', section: 'General/Other', label: 'Strategy to Purchase Recommendation', enabled: true },
  { id: 'dd-gen-2', section: 'General/Other', label: 'Next Steps and Actions outlined', enabled: true },

  // Post Purchase
  { id: 'dd-post-1', section: 'Post Purchase', label: 'Send the Next Steps email and confirm a time for PSI, book this in and check if clients wish to attend', enabled: true },
  { id: 'dd-post-2', section: 'Post Purchase', label: 'Save photos to file including floorplan. Mae sure the signed S&P is saved to file.', enabled: true },
];

/**
 * Field defaults for {@link CompanySettings}. Single source of truth for the
 * Mongoose schema defaults, the PDF builders' fallback, and the UI's
 * "reset to default". Values mirror today's hardcoded PDF output so existing
 * documents render identically until an admin overrides them.
 */
export const COMPANY_SETTINGS_DEFAULTS = {
  firmName: 'Martelli Buyers Agents',
  firmAddress: '1B George Street, Parnell, Auckland',
  firmLicence: 'Licensed REAA 2008',
  gstNumber: '',
  bankDetails: '',
  brandColor: '#768255',
  logoDataUrl: '',
  invoiceTitle: 'Tax Invoice',
  invoicePaymentTerms: '7 working days from issue',
  invoiceDefaultDescription: 'Buyer agency services',
  invoiceFooterText:
    'Please reference the invoice number with your payment. GST number and bank details are provided on the official statement. This document was generated by Martelli Buyers Agents.',
  gstRate: 15,
  emailLogoUrl: '',
  emailSignatureHtml: '',
  emailBrandingEnabled: true,
} as const;

/** Shape returned by GET /api/outlook/status (never includes tokens). */
export interface OutlookStatus {
  configured: boolean;
  connected: boolean;
  accountEmail: string;
  connectedByEmail: string;
  syncStatus: 'idle' | 'running' | 'done' | 'error';
  lastSyncAt: string;
  syncedCount: number;
  syncError: string;
}
