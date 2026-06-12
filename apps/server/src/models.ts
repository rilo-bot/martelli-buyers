import mongoose, { Schema, model } from 'mongoose';

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
    status: { type: String, default: 'pending' },
    notes: { type: String, default: '' },
    completedBy: { type: String, default: '' },
    completedAt: { type: String, default: '' },
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
    role: { type: String, enum: ['admin', 'staff', 'client', 'agent'], default: 'staff' },
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
    invoiceIds: { type: [String], default: [] },
    assignedTo: { type: String, default: '' },
    aiConsentStatus: { type: String, enum: ['pending', 'granted', 'declined'], default: 'pending' },
    aiConsentDate: { type: String, default: '' },
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
      enum: ['active', 'shortlisted', 'inspected', 'passed', 'offer_made', 'purchased'],
      default: 'active',
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
    subject: { type: String, default: '' },
    body: { type: String, default: '' },
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

/* ───────────────────────── model registry ───────────────────────────── */

export const User = model('User', UserSchema);
export const OtpToken = model('OtpToken', OtpTokenSchema);

export const Lead = model('Lead', LeadSchema);
export const Deal = model('Deal', DealSchema);
export const Client = model('Client', ClientSchema);
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
// Singleton — not a CRUD resource (no entry in RESOURCES).
export const XeroConnection = model('XeroConnection', XeroConnectionSchema);

export type AnyModel = mongoose.Model<any>;

/** Maps REST resource path → Mongoose model for the generic CRUD router. */
export const RESOURCES: Record<string, AnyModel> = {
  leads: Lead,
  deals: Deal,
  clients: Client,
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
};
