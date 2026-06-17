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
  { key: 'clients', label: 'Clients', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'journeys', label: 'Buyer Journeys', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'properties', label: 'Properties', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'invoices', label: 'Invoices', actions: ['view', 'create', 'edit', 'delete', 'send'] },
  { key: 'agents', label: 'Agents', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'emails', label: 'Emails', actions: ['view', 'create', 'edit', 'delete', 'send'] },
  { key: 'dueDiligence', label: 'Due Diligence', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'documents', label: 'Documents', actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'settings', label: 'Settings', actions: ['view', 'manage'] },
  { key: 'team', label: 'Team & Roles', actions: ['view', 'manage'] },
];

/** Flat list of every valid permission string. */
export const ALL_PERMISSIONS: Permission[] = PERMISSION_MODULES.flatMap((m) =>
  m.actions.map((a) => `${m.key}:${a}`),
);

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

const OPERATIONAL_FULL = ['leads', 'clients', 'journeys', 'properties', 'agents', 'dueDiligence', 'documents'];

/** Default permission set per built-in role. Super admin always gets everything regardless. */
export const DEFAULT_ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  admin: ALL_PERMISSIONS,
  manager: [
    'dashboard:view',
    ...OPERATIONAL_FULL.flatMap((m) => [`${m}:view`, `${m}:create`, `${m}:edit`, `${m}:delete`]),
    'invoices:view', 'invoices:create', 'invoices:edit', 'invoices:delete', 'invoices:send',
    'emails:view', 'emails:create', 'emails:edit', 'emails:delete', 'emails:send',
    'settings:view',
  ],
  staff: [
    'dashboard:view',
    ...OPERATIONAL_FULL.flatMap((m) => [`${m}:view`, `${m}:create`, `${m}:edit`]),
    'invoices:view',
    'emails:view',
    'settings:view',
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
  invoiceIds: string[];
  assignedTo: string;
  aiConsentStatus: ConsentStatus;
  aiConsentDate: string;
  createdAt: string;
  updatedAt: string;
}

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
  body: string;
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
  status: ChecklistItemStatus;
  notes: string;
  completedBy: string;
  completedAt: string;
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
  createdAt: string;
  updatedAt: string;
}

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
  brandColor: '#1e6fb0',
  logoDataUrl: '',
  invoiceTitle: 'Tax Invoice',
  invoicePaymentTerms: '7 working days from issue',
  invoiceDefaultDescription: 'Buyer agency services',
  invoiceFooterText:
    'Please reference the invoice number with your payment. GST number and bank details are provided on the official statement. This document was generated by Martelli Buyers Agents.',
  gstRate: 15,
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
