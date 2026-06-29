import mongoose, { Schema, model } from 'mongoose';
import {
  COMPANY_SETTINGS_DEFAULTS,
  DD_CHECKLIST_TEMPLATE_DEFAULTS,
  CONTACT_FORM_FIELD_CATALOG,
  CONTACT_FORM_STYLE_DEFAULTS,
  CONTACT_FORM_CONTENT_DEFAULTS,
} from '@rilo/shared';

/* ───────────────────────── shared options ───────────────────────────── */

// Every top-level document: managed timestamps + JSON shape that matches the
// shared TS types (`id` string, no `_id`/`__v`). Date fields serialize to ISO
// strings automatically through res.json().
const baseOpts = {
  timestamps: true,
  toJSON: {
    versionKey: false,
    transform(_doc: unknown, ret: Record<string, unknown>) {
      ret.id = ret._id ? String(ret._id) : ret.id;
      delete ret._id;
      return ret;
    },
  },
} as const;

// Embedded subdocuments keep the client-provided string `id` and have no _id.
const sub = { _id: false } as const;

/* ───────────────────────── sub-schemas ──────────────────────────────── */

const StageChecklistItemSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: '' },
    description: { type: String, default: '' },
    required: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  sub,
);

const EvidenceItemSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: '' },
    url: { type: String, default: '' },
    type: { type: String, default: 'link' },
    addedAt: { type: String, default: '' },
  },
  sub,
);

const ComparableSaleSchema = new Schema(
  {
    id: { type: String, required: true },
    address: { type: String, default: '' },
    suburb: { type: String, default: '' },
    salePrice: { type: Number, default: 0 },
    saleDate: { type: String, default: '' },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    landSize: { type: Number, default: 0 },
    notes: { type: String, default: '' },
    sourceUrl: { type: String, default: '' },
  },
  sub,
);

const DDChecklistItemSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: '' },
    section: { type: String, default: '' },
    status: { type: String, default: 'pending' },
    notes: { type: String, default: '' },
    completedBy: { type: String, default: '' },
    completedAt: { type: String, default: '' },
  },
  sub,
);

// One row of the org-wide DD audit-checklist template (on CompanySettings).
const DDChecklistTemplateItemSchema = new Schema(
  {
    id: { type: String, required: true },
    label: { type: String, default: '' },
    section: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
  },
  sub,
);

const CommentAttachmentSchema = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, default: '' },
    url: { type: String, default: '' },
    size: { type: Number, default: 0 },
    type: { type: String, default: '' },
  },
  sub,
);

const ActionItemSchema = new Schema(
  {
    id: { type: String, required: true },
    description: { type: String, default: '' },
    assignedTo: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    completed: { type: Boolean, default: false },
  },
  sub,
);

/* ───────────────────────── auth models ──────────────────────────────── */

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: '' },
    // Public URL of the user's profile photo (uploaded to S3). Empty → initials.
    avatarUrl: { type: String, default: '' },
    // Role key — references a Role.key (built-in 'admin'|'manager'|'staff' or a
    // custom role). No enum: custom role keys can't be enumerated; the users
    // route validates that the key references an existing Role on write.
    role: { type: String, default: 'staff' },
    // 'invited' once an admin adds them (until they accept/login), then 'active'.
    // Default 'active' so the super admin + any pre-existing users aren't pending.
    status: { type: String, enum: ['invited', 'active'], default: 'active' },
    // Single-use auto-login invite credential — never serialised (select:false).
    inviteToken: { type: String, default: '', select: false, index: true },
    inviteExpiresAt: { type: Date, select: false },
  },
  baseOpts,
);

// A role definition: a named set of permission strings. Built-in roles have
// isSystem=true (cannot be deleted; only the super admin may edit them).
const RoleSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  baseOpts,
);

const OtpTokenSchema = new Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumed: { type: Boolean, default: false },
    // first-time signup carries the name to apply on verify
    pendingName: { type: String, default: '' },
  },
  { timestamps: true },
);
// TTL index — Mongo purges expired tokens automatically.
OtpTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

/* ───────────────────────── domain models ────────────────────────────── */

const ClientSchema = new Schema(
  {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    company: { type: String, default: '' },
    notes: { type: String, default: '' },
    leadIds: { type: [String], default: [] },
    dealIds: { type: [String], default: [] },
    tags: { type: [String], default: [] },
    assignedTo: { type: String, default: '' },
    // Linked Xero ContactID + last successful push (empty until synced).
    xeroContactId: { type: String, default: '' },
    xeroSyncedAt: { type: String, default: '' },
  },
  baseOpts,
);

const QualificationStageSchema = new Schema(
  {
    label: { type: String, default: '' },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
    color: { type: String, default: 'cyan' },
    checklistItems: { type: [StageChecklistItemSchema], default: [] },
  },
  baseOpts,
);

const LeadSchema = new Schema(
  {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    source: { type: String, default: '' },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'agreement_sent', 'active', 'won', 'lost'],
      default: 'new',
    },
    qualificationStageId: { type: String, default: '' },
    stageProgress: { type: Schema.Types.Mixed, default: {} },
    notes: { type: String, default: '' },
    budget: { type: Number, default: 0 },
    propertyType: { type: String, default: '' },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    preferredSuburbs: { type: [String], default: [] },
    assignedTo: { type: String, default: '' },
    clientId: { type: String, default: '' },
    // Buyer's agency agreement (authored + e-signed during the lead phase).
    agreementStatus: { type: String, enum: ['pending', 'sent', 'signed'], default: 'pending' },
    agreementUrl: { type: String, default: '' },
    agreementSignToken: { type: String, default: '', index: true },
    agreementSentAt: { type: String, default: '' },
    agreementSignerName: { type: String, default: '' },
    agreementSignedAt: { type: String, default: '' },
    agreementSignerIp: { type: String, default: '' },
    agreementSignatureImage: { type: String, default: '' },
    agreementBodyHtml: { type: String, default: '' },
  },
  baseOpts,
);

/**
 * Raw website "Contact Us" submission. Lands here first (not as a Lead) so the
 * public form can't flood the qualified pipeline. Staff review enquiries and
 * convert the worthwhile ones into Leads via /api/enquiries/:id/convert, which
 * stamps status 'converted' + convertedLeadId.
 */
const ContactEnquirySchema = new Schema(
  {
    name: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    enquiryType: { type: String, default: '' },
    budget: { type: String, default: '' },
    location: { type: String, default: '' },
    message: { type: String, default: '' },
    consent: { type: Boolean, default: false },
    source: { type: String, default: 'Website' },
    status: {
      type: String,
      enum: ['new', 'reviewed', 'converted', 'archived'],
      default: 'new',
    },
    // Set when an enquiry is converted; links back to the created Lead.
    convertedLeadId: { type: String, default: '' },
    assignedTo: { type: String, default: '' },
    notes: { type: String, default: '' },
    // Submitted values for fields with no dedicated column (custom + extras).
    extraFields: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  baseOpts,
);

const DealSchema = new Schema(
  {
    leadId: { type: String, default: '' },
    clientId: { type: String, default: '' },
    clientName: { type: String, default: '' },
    clientEmail: { type: String, default: '' },
    clientPhone: { type: String, default: '' },
    stage: {
      type: String,
      enum: ['qualification', 'search', 'shortlisting', 'due_diligence', 'offer', 'settlement', 'complete'],
      default: 'qualification',
    },
    brief: { type: String, default: '' },
    budget: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },
    feeType: { type: String, enum: ['fixed', 'percentage'], default: 'fixed' },
    preferredSuburbs: { type: [String], default: [] },
    propertyType: { type: String, default: '' },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    agreementStatus: { type: String, enum: ['pending', 'sent', 'signed'], default: 'pending' },
    agreementUrl: { type: String, default: '' },
    agreementSignToken: { type: String, default: '', index: true },
    agreementSentAt: { type: String, default: '' },
    agreementSignerName: { type: String, default: '' },
    agreementSignedAt: { type: String, default: '' },
    agreementSignerIp: { type: String, default: '' },
    // Drawn signature as a PNG data URL ('data:image/png;base64,...'). Empty when
    // the buyer signed by typing their name instead of drawing.
    agreementSignatureImage: { type: String, default: '' },
    // Per-deal agreement text overrides. Empty means "use the generated default"
    // so editing deal fields (fee, budget…) keeps flowing into the PDF until an
    // admin deliberately customises the wording.
    agreementFeeText: { type: String, default: '' },
    agreementTermsText: { type: String, default: '' },
    agreementClauses: { type: String, default: '' },
    // Rich-HTML agreement body from the WYSIWYG editor. '' = not yet migrated,
    // so the PDF build falls back to the legacy PDFKit builder. Seeded lazily on
    // first editor open, then the single source of truth.
    agreementBodyHtml: { type: String, default: '' },
    invoiceIds: { type: [String], default: [] },
    assignedTo: { type: String, default: '' },
    aiConsentStatus: { type: String, enum: ['pending', 'granted', 'declined'], default: 'pending' },
    aiConsentDate: { type: String, default: '' },
  },
  baseOpts,
);

const OfferSchema = new Schema(
  {
    dealId: { type: String, default: '', index: true },
    propertyId: { type: String, default: '' },
    amount: { type: Number, default: 0 },
    depositAmount: { type: Number, default: 0 },
    dateSubmitted: { type: String, default: '' },
    conditions: { type: String, default: '' },
    status: {
      type: String,
      enum: ['draft', 'submitted', 'negotiating', 'accepted', 'declined', 'withdrawn'],
      default: 'draft',
    },
    counterOffer: { type: Number, default: 0 },
    outcome: { type: String, default: '' },
    fileUrls: { type: [String], default: [] },
    notes: { type: String, default: '' },
  },
  baseOpts,
);

const TaskSchema = new Schema(
  {
    dealId: { type: String, default: '', index: true },
    propertyId: { type: String, default: '' },
    title: { type: String, default: '' },
    type: {
      type: String,
      enum: ['call', 'viewing', 'lim', 'builders_report', 'finance', 'agreement', 'other'],
      default: 'other',
    },
    assignedTo: { type: String, default: '' },
    dueDate: { type: String, default: '' },
    completed: { type: Boolean, default: false },
    completedAt: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    notes: { type: String, default: '' },
  },
  baseOpts,
);

const PurchaseSchema = new Schema(
  {
    dealId: { type: String, default: '', index: true },
    propertyId: { type: String, default: '' },
    purchasePrice: { type: Number, default: 0 },
    depositPaid: { type: Number, default: 0 },
    unconditionalDate: { type: String, default: '' },
    settlementDate: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'unconditional', 'settled'], default: 'pending' },
    solicitor: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  baseOpts,
);

const PropertySchema = new Schema(
  {
    dealId: { type: String, default: '' },
    address: { type: String, default: '' },
    suburb: { type: String, default: '' },
    price: { type: Number, default: 0 },
    priceGuide: { type: String, default: '' },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    carparks: { type: Number, default: 0 },
    landSize: { type: Number, default: 0 },
    propertyType: { type: String, default: '' },
    status: {
      type: String,
      enum: ['suggested', 'interested', 'viewed', 'shortlisted', 'rejected', 'offer_placed', 'purchased'],
      default: 'suggested',
    },
    notes: { type: String, default: '' },
    clientVisibleNotes: { type: String, default: '' },
    isClientVisible: { type: Boolean, default: false },
    agentId: { type: String, default: '' },
    sourceAgentName: { type: String, default: '' },
    listingUrl: { type: String, default: '' },
    photos: { type: [String], default: [] },
    isOffMarket: { type: Boolean, default: false },
    offMarketPropertyId: { type: String, default: '' },
  },
  baseOpts,
);

const OffMarketPropertySchema = new Schema(
  {
    address: { type: String, default: '' },
    suburb: { type: String, default: '' },
    priceGuide: { type: String, default: '' },
    priceLow: { type: Number, default: 0 },
    priceHigh: { type: Number, default: 0 },
    bedrooms: { type: Number, default: 0 },
    bathrooms: { type: Number, default: 0 },
    carparks: { type: Number, default: 0 },
    propertyType: { type: String, default: '' },
    notes: { type: String, default: '' },
    sourceAgentId: { type: String, default: '' },
    sourceAgentName: { type: String, default: '' },
    attachments: { type: [String], default: [] },
    usedInDealIds: { type: [String], default: [] },
    status: { type: String, default: 'available' },
    isActive: { type: Boolean, default: true },
  },
  baseOpts,
);

const AgentSchema = new Schema(
  {
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    agency: { type: String, default: '' },
    geoTag: { type: String, enum: ['East', 'West', 'North', 'Central'], default: 'Central' },
    suburbs: { type: [String], default: [] },
    isPreferred: { type: Boolean, default: false },
    notes: { type: String, default: '' },
    lastContactDate: { type: String, default: '' },
    dealsReferredIds: { type: [String], default: [] },
  },
  baseOpts,
);

const EmailTemplateSchema = new Schema(
  {
    name: { type: String, default: '' },
    category: {
      type: String,
      enum: ['welcome', 'dd_request', 'status_update', 'requirement_blast', 'thank_you', 'post_settlement', 'other'],
      default: 'other',
    },
    // Intended audience — drives recipient pre-selection in the Send Email dialog.
    // No default: legacy templates predating this field stay undefined so the
    // client falls back to inferring the audience from `category`.
    recipientType: { type: String, enum: ['client', 'agent'] },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    // Rich HTML body (WYSIWYG). '' for legacy templates → server falls back to `body`.
    bodyHtml: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    variables: { type: [String], default: [] },
  },
  baseOpts,
);

const EmailCampaignSchema = new Schema(
  {
    dealId: { type: String, default: '' },
    templateId: { type: String, default: '' },
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
    bodyHtml: { type: String, default: '' },
    recipientType: { type: String, enum: ['agents', 'client', 'stakeholders'], default: 'agents' },
    agentGeoFilter: { type: [String], default: [] },
    preferredOnly: { type: Boolean, default: false },
    recipientCount: { type: Number, default: 0 },
    sentAt: { type: String, default: '' },
    status: { type: String, enum: ['draft', 'sent'], default: 'draft' },
  },
  baseOpts,
);

const InvoiceSchema = new Schema(
  {
    dealId: { type: String, default: '' },
    xeroInvoiceId: { type: String, default: '' },
    xeroStatus: { type: String, default: '' },
    xeroUrl: { type: String, default: '' },
    xeroLastSyncedAt: { type: String, default: '' },
    invoiceNumber: { type: String, default: '' },
    type: { type: String, enum: ['engagement', 'milestone', 'final'], default: 'engagement' },
    amount: { type: Number, default: 0 },
    gst: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'sent', 'paid', 'overdue'], default: 'draft' },
    dueDate: { type: String, default: '' },
    paidDate: { type: String, default: '' },
    description: { type: String, default: '' },
    // Overdue-reminder tracking (manual button + automated scheduler).
    lastReminderAt: { type: String, default: '' },
    reminderCount: { type: Number, default: 0 },
  },
  baseOpts,
);

// Single org-wide Xero OAuth connection (one document). Tokens are server-side
// only and never serialised to the client.
const XeroConnectionSchema = new Schema(
  {
    tenantId: { type: String, default: '' },
    tenantName: { type: String, default: '' },
    accessToken: { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    expiresAt: { type: Date },
    scopes: { type: String, default: '' },
    connectedByEmail: { type: String, default: '' },
    connectedAt: { type: String, default: '' },
    // Initial-import progress (set when pulling Contacts/Invoices from Xero).
    importStatus: { type: String, enum: ['idle', 'running', 'done', 'error'], default: 'idle' },
    lastImportAt: { type: String, default: '' },
    importedClients: { type: Number, default: 0 },
    linkedInvoices: { type: Number, default: 0 },
    importError: { type: String, default: '' },
  },
  baseOpts,
);

// Single org-wide Outlook (Microsoft Graph) connection (one document). Tokens
// and delta cursors are server-side only and never serialised to the client.
const OutlookConnectionSchema = new Schema(
  {
    // The mailbox these tokens read (from Graph /me on connect).
    accountEmail: { type: String, default: '' },
    accessToken: { type: String, default: '' },
    refreshToken: { type: String, default: '' },
    expiresAt: { type: Date },
    scopes: { type: String, default: '' },
    connectedByEmail: { type: String, default: '' },
    connectedAt: { type: String, default: '' },
    // Graph @odata.deltaLink cursors — one per synced folder. Empty → full sync.
    inboxDeltaLink: { type: String, default: '' },
    sentDeltaLink: { type: String, default: '' },
    // Background sync progress.
    syncStatus: { type: String, enum: ['idle', 'running', 'done', 'error'], default: 'idle' },
    lastSyncAt: { type: String, default: '' },
    syncedCount: { type: Number, default: 0 },
    syncError: { type: String, default: '' },
  },
  baseOpts,
);

// ── Contact form builder sub-schemas (embedded on CompanySettings) ──
const ContactFormFieldSchema = new Schema(
  {
    key: { type: String, required: true },
    type: { type: String, default: 'text' },
    label: { type: String, default: '' },
    placeholder: { type: String, default: '' },
    required: { type: Boolean, default: false },
    enabled: { type: Boolean, default: true },
    options: { type: [String], default: undefined },
    system: { type: Boolean, default: false },
    fullWidth: { type: Boolean, default: undefined },
  },
  sub,
);

const ContactFormContactDetailSchema = new Schema(
  {
    label: { type: String, default: '' },
    value: { type: String, default: '' },
    href: { type: String, default: '' },
  },
  sub,
);

const ContactFormStylesSchema = new Schema(
  {
    accentColor: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.accentColor },
    backgroundColor: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.backgroundColor },
    surfaceColor: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.surfaceColor },
    textColor: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.textColor },
    buttonTextColor: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.buttonTextColor },
    borderColor: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.borderColor },
    font: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.font },
    cornerRadius: { type: Number, default: CONTACT_FORM_STYLE_DEFAULTS.cornerRadius },
    maxWidth: { type: Number, default: CONTACT_FORM_STYLE_DEFAULTS.maxWidth },
    padding: { type: Number, default: CONTACT_FORM_STYLE_DEFAULTS.padding },
    borderWidth: { type: Number, default: CONTACT_FORM_STYLE_DEFAULTS.borderWidth },
    shadow: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.shadow },
    layout: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.layout },
    labelStyle: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.labelStyle },
    buttonStyle: { type: String, default: CONTACT_FORM_STYLE_DEFAULTS.buttonStyle },
    showLogo: { type: Boolean, default: CONTACT_FORM_STYLE_DEFAULTS.showLogo },
  },
  sub,
);

const ContactFormContentSchema = new Schema(
  {
    eyebrow: { type: String, default: CONTACT_FORM_CONTENT_DEFAULTS.eyebrow },
    heading: { type: String, default: CONTACT_FORM_CONTENT_DEFAULTS.heading },
    intro: { type: String, default: CONTACT_FORM_CONTENT_DEFAULTS.intro },
    submitLabel: { type: String, default: CONTACT_FORM_CONTENT_DEFAULTS.submitLabel },
    successHeading: { type: String, default: CONTACT_FORM_CONTENT_DEFAULTS.successHeading },
    successMessage: { type: String, default: CONTACT_FORM_CONTENT_DEFAULTS.successMessage },
    contactDetails: {
      type: [ContactFormContactDetailSchema],
      default: () => CONTACT_FORM_CONTENT_DEFAULTS.contactDetails.map((d) => ({ ...d })),
    },
  },
  sub,
);

// Token managed server-side (publish/regenerate only); '' until first publish.
const ContactFormConfigSchema = new Schema(
  {
    published: { type: Boolean, default: false },
    token: { type: String, default: '' },
    allowedOrigins: { type: [String], default: [] },
    fields: {
      type: [ContactFormFieldSchema],
      default: () => CONTACT_FORM_FIELD_CATALOG.map((f) => ({ ...f })),
    },
    styles: { type: ContactFormStylesSchema, default: () => ({}) },
    content: { type: ContactFormContentSchema, default: () => ({}) },
  },
  sub,
);

// Single org-wide company settings (one document): identity, branding and
// invoice-template text consumed by the PDF builders. Defaults mirror today's
// hardcoded output so PDFs are unchanged until an admin customises them.
const CompanySettingsSchema = new Schema(
  {
    firmName: { type: String, default: COMPANY_SETTINGS_DEFAULTS.firmName },
    firmAddress: { type: String, default: COMPANY_SETTINGS_DEFAULTS.firmAddress },
    firmLicence: { type: String, default: COMPANY_SETTINGS_DEFAULTS.firmLicence },
    gstNumber: { type: String, default: COMPANY_SETTINGS_DEFAULTS.gstNumber },
    bankDetails: { type: String, default: COMPANY_SETTINGS_DEFAULTS.bankDetails },
    brandColor: { type: String, default: COMPANY_SETTINGS_DEFAULTS.brandColor },
    logoDataUrl: { type: String, default: COMPANY_SETTINGS_DEFAULTS.logoDataUrl },
    invoiceTitle: { type: String, default: COMPANY_SETTINGS_DEFAULTS.invoiceTitle },
    invoicePaymentTerms: { type: String, default: COMPANY_SETTINGS_DEFAULTS.invoicePaymentTerms },
    invoiceDefaultDescription: { type: String, default: COMPANY_SETTINGS_DEFAULTS.invoiceDefaultDescription },
    invoiceFooterText: { type: String, default: COMPANY_SETTINGS_DEFAULTS.invoiceFooterText },
    gstRate: { type: Number, default: COMPANY_SETTINGS_DEFAULTS.gstRate },
    emailLogoUrl: { type: String, default: COMPANY_SETTINGS_DEFAULTS.emailLogoUrl },
    emailSignatureHtml: { type: String, default: COMPANY_SETTINGS_DEFAULTS.emailSignatureHtml },
    emailBrandingEnabled: { type: Boolean, default: COMPANY_SETTINGS_DEFAULTS.emailBrandingEnabled },
    // Fresh copy per document so the shared default array is never mutated.
    ddChecklistTemplate: {
      type: [DDChecklistTemplateItemSchema],
      default: () => DD_CHECKLIST_TEMPLATE_DEFAULTS.map((i) => ({ ...i })),
    },
    contactForm: { type: ContactFormConfigSchema, default: () => ({}) },
  },
  baseOpts,
);

// Sender/recipient pair on a synced email (no _id; not client-provided).
const EmailAddressSchema = new Schema(
  {
    name: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  sub,
);

// Attachment metadata only — bytes are streamed on demand from Graph via
// /api/outlook/messages/:id/attachments/:attachmentId.
const EmailAttachmentSchema = new Schema(
  {
    graphId: { type: String, default: '' },
    name: { type: String, default: '' },
    size: { type: Number, default: 0 },
    contentType: { type: String, default: '' },
    isInline: { type: Boolean, default: false },
  },
  sub,
);

// An Outlook email pulled into the CRM and tagged against a client/deal. Records
// originate from the background sync (upserted by graphId); the UI lists + links
// them but never creates them by hand.
const EmailMessageSchema = new Schema(
  {
    // Graph message id — unique so re-syncs upsert instead of duplicating.
    graphId: { type: String, default: '', unique: true, index: true },
    internetMessageId: { type: String, default: '', index: true },
    conversationId: { type: String, default: '', index: true },
    subject: { type: String, default: '' },
    bodyPreview: { type: String, default: '' },
    bodyHtml: { type: String, default: '' },
    fromName: { type: String, default: '' },
    fromAddress: { type: String, default: '', index: true },
    toRecipients: { type: [EmailAddressSchema], default: [] },
    ccRecipients: { type: [EmailAddressSchema], default: [] },
    sentAt: { type: String, default: '' },
    receivedAt: { type: String, default: '' },
    direction: { type: String, enum: ['inbound', 'outbound'], default: 'inbound' },
    folder: { type: String, enum: ['inbox', 'sent'], default: 'inbox' },
    hasAttachments: { type: Boolean, default: false },
    attachments: { type: [EmailAttachmentSchema], default: [] },
    // Tagging ("link this email to a client/deal"). linkSource '' = unlinked.
    clientId: { type: String, default: '', index: true },
    dealId: { type: String, default: '', index: true },
    linkSource: { type: String, enum: ['', 'auto', 'manual'], default: '' },
    linkedBy: { type: String, default: '' },
    linkedAt: { type: String, default: '' },
  },
  baseOpts,
);

// Append-only event log for the Buyer Journey timeline + audit trail. Written
// server-side only (never a CRUD resource); read via /api/timeline.
const AuditEventSchema = new Schema(
  {
    entityType: { type: String, default: '' },
    entityId: { type: String, default: '', index: true },
    dealId: { type: String, default: '', index: true },
    action: { type: String, default: '' },
    field: { type: String, default: '' },
    fromValue: { type: String, default: '' },
    toValue: { type: String, default: '' },
    actorId: { type: String, default: '' },
    actorName: { type: String, default: '' },
    at: { type: String, default: '' },
  },
  baseOpts,
);

const DueDiligenceSchema = new Schema(
  {
    propertyId: { type: String, default: '' },
    dealId: { type: String, default: '' },
    address: { type: String, default: '' },
    floodMapUrl: { type: String, default: '' },
    floodMapNotes: { type: String, default: '' },
    naturalHazardsUrl: { type: String, default: '' },
    naturalHazardsNotes: { type: String, default: '' },
    councilRecordsUrl: { type: String, default: '' },
    evidenceLinks: { type: [EvidenceItemSchema], default: [] },
    comparableSales: { type: [ComparableSaleSchema], default: [] },
    checklistItems: { type: [DDChecklistItemSchema], default: [] },
    reportGenerated: { type: Boolean, default: false },
    reportUrl: { type: String, default: '' },
    internalNotes: { type: String, default: '' },
  },
  baseOpts,
);

const ClientCommentSchema = new Schema(
  {
    dealId: { type: String, default: '' },
    propertyId: { type: String, default: '' },
    authorId: { type: String, default: '' },
    authorName: { type: String, default: '' },
    authorRole: { type: String, enum: ['admin', 'staff', 'client', 'agent'], default: 'staff' },
    content: { type: String, default: '' },
    attachments: { type: [CommentAttachmentSchema], default: [] },
    isClientVisible: { type: Boolean, default: true },
  },
  baseOpts,
);

const AISummarySchema = new Schema(
  {
    dealId: { type: String, default: '' },
    type: { type: String, enum: ['call', 'meeting'], default: 'call' },
    title: { type: String, default: '' },
    date: { type: String, default: '' },
    participants: { type: [String], default: [] },
    summary: { type: String, default: '' },
    actionItems: { type: [ActionItemSchema], default: [] },
    rawTranscript: { type: String, default: '' },
    isVisibleToClient: { type: Boolean, default: false },
    generatedAt: { type: String, default: '' },
  },
  baseOpts,
);

// A catalogued file. Bytes live in S3 (uploaded via /api/uploads/sign); this
// record holds the metadata and a polymorphic link to its parent entity. Free-
// form entityType (no enum) mirrors AuditEvent — keeps unlinked docs ('') valid.
const DocumentSchema = new Schema(
  {
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    url: { type: String, default: '' },
    storageKey: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    // Blank by default — a category is optional and only set when the uploader
    // explicitly classifies the file. '' is included so unclassified docs pass.
    category: {
      type: String,
      enum: ['', 'agreement', 'invoice', 'dd_report', 'id_verification', 'lim', 'building_report', 'contract', 'photo', 'other'],
      default: '',
    },
    entityType: { type: String, default: '', index: true },
    entityId: { type: String, default: '', index: true },
    // Denormalised journey scope so a deal's whole document set is one query.
    dealId: { type: String, default: '', index: true },
    uploadedBy: { type: String, default: '' },
    tags: { type: [String], default: [] },
  },
  baseOpts,
);
DocumentSchema.index({ entityType: 1, entityId: 1 });

const ReferralPartnerSchema = new Schema(
  {
    name: { type: String, default: '' },
    company: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    type: { type: String, enum: ['lawyer', 'mortgage_broker', 'financial_advisor', 'other'], default: 'other' },
    notes: { type: String, default: '' },
    dealsReferredIds: { type: [String], default: [] },
  },
  baseOpts,
);

// Cached AI daily briefing — one document per user per day (NZ date). Not a
// CRUD resource; served read-only via /api/ai/daily-summary.
const DailySummaryItemSchema = new Schema(
  {
    text: { type: String, default: '' },
    // Optional in-app route to deep-link the insight (e.g. '/leads').
    to: { type: String, default: '' },
  },
  sub,
);

const DailySummarySchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    // 'YYYY-MM-DD' in Pac/Auckland — the firm's day boundary.
    date: { type: String, required: true, index: true },
    role: { type: String, default: '' },
    headline: { type: String, default: '' },
    insights: { type: [DailySummaryItemSchema], default: [] },
    focus: { type: String, default: '' },
    generatedAt: { type: String, default: '' },
  },
  baseOpts,
);
DailySummarySchema.index({ userId: 1, date: 1 }, { unique: true });

/* ───────────────────────── model registry ───────────────────────────── */

export const User = model('User', UserSchema);
export const OtpToken = model('OtpToken', OtpTokenSchema);
// Roles are managed via the gated /api/roles router — not a generic CRUD resource.
export const Role = model('Role', RoleSchema);

export const Lead = model('Lead', LeadSchema);
export const ContactEnquiry = model('ContactEnquiry', ContactEnquirySchema);
export const Deal = model('Deal', DealSchema);
export const Client = model('Client', ClientSchema);
export const Offer = model('Offer', OfferSchema);
export const Task = model('Task', TaskSchema);
export const Purchase = model('Purchase', PurchaseSchema);
export const Property = model('Property', PropertySchema);
export const OffMarketProperty = model('OffMarketProperty', OffMarketPropertySchema);
export const Agent = model('Agent', AgentSchema);
export const EmailTemplate = model('EmailTemplate', EmailTemplateSchema);
export const EmailCampaign = model('EmailCampaign', EmailCampaignSchema);
export const Invoice = model('Invoice', InvoiceSchema);
export const DueDiligence = model('DueDiligence', DueDiligenceSchema);
export const ClientComment = model('ClientComment', ClientCommentSchema);
export const AISummary = model('AISummary', AISummarySchema);
export const QualificationStage = model('QualificationStage', QualificationStageSchema);
export const ReferralPartner = model('ReferralPartner', ReferralPartnerSchema);
export const Document = model('Document', DocumentSchema);
export const EmailMessage = model('EmailMessage', EmailMessageSchema);
// Singleton — not a CRUD resource (no entry in RESOURCES).
export const XeroConnection = model('XeroConnection', XeroConnectionSchema);
// Singleton org-wide Outlook connection — not a CRUD resource (managed via /api/outlook).
export const OutlookConnection = model('OutlookConnection', OutlookConnectionSchema);
// Singleton org-wide company settings — not a CRUD resource (managed via /api/company-settings).
export const CompanySettings = model('CompanySettings', CompanySettingsSchema);
// Append-only audit/timeline log — not a CRUD resource (read-only via /api/timeline).
export const AuditEvent = model('AuditEvent', AuditEventSchema);
// Cached AI daily briefings — not a CRUD resource (served via /api/ai/daily-summary).
export const DailySummary = model('DailySummary', DailySummarySchema);

export type AnyModel = mongoose.Model<any>;

/**
 * Maps each REST resource to its RBAC permission module. The generic CRUD
 * router gates every request on `${module}:${action}` (GET→view, POST→create,
 * PATCH→edit, DELETE→delete). Keep in sync with RESOURCES below.
 */
export const RESOURCE_MODULE: Record<string, string> = {
  leads: 'leads',
  enquiries: 'enquiries',
  deals: 'journeys',
  clients: 'clients',
  offers: 'journeys',
  tasks: 'journeys',
  purchases: 'journeys',
  properties: 'properties',
  'off-market': 'properties',
  agents: 'agents',
  'email-templates': 'emails',
  'email-campaigns': 'emails',
  invoices: 'invoices',
  'due-diligence': 'dueDiligence',
  comments: 'journeys',
  'ai-summaries': 'journeys',
  // Editing stages needs settings:manage, but all roles get settings:view so
  // the pipeline loads. (The router maps GET→view automatically.)
  'qualification-stages': 'settings',
  'referral-partners': 'agents',
  documents: 'documents',
  // Synced Outlook emails — read with emails:view, tag/link with emails:edit.
  'email-messages': 'emails',
};

/** Maps REST resource path → Mongoose model for the generic CRUD router. */
export const RESOURCES: Record<string, AnyModel> = {
  leads: Lead,
  enquiries: ContactEnquiry,
  deals: Deal,
  clients: Client,
  offers: Offer,
  tasks: Task,
  purchases: Purchase,
  properties: Property,
  'off-market': OffMarketProperty,
  agents: Agent,
  'email-templates': EmailTemplate,
  'email-campaigns': EmailCampaign,
  invoices: Invoice,
  'due-diligence': DueDiligence,
  comments: ClientComment,
  'ai-summaries': AISummary,
  'qualification-stages': QualificationStage,
  'referral-partners': ReferralPartner,
  documents: Document,
  'email-messages': EmailMessage,
};
