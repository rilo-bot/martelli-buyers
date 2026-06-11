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
export type PropertyStatus = 'active' | 'shortlisted' | 'inspected' | 'passed' | 'offer_made' | 'purchased';
export type AgentGeo = 'East' | 'West' | 'North' | 'Central';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue';
export type EmailTemplateCategory = 'welcome' | 'dd_request' | 'status_update' | 'requirement_blast' | 'thank_you' | 'post_settlement' | 'other';
export type ChecklistItemStatus = 'pending' | 'completed' | 'na';
export type ConsentStatus = 'pending' | 'granted' | 'declined';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
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
  invoiceIds: string[];
  assignedTo: string;
  aiConsentStatus: ConsentStatus;
  aiConsentDate: string;
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
  subject: string;
  body: string;
  isActive: boolean;
  variables: string[];
  createdAt: string;
  updatedAt: string;
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
  invoiceNumber: string;
  type: 'engagement' | 'milestone' | 'final';
  amount: number;
  gst: number;
  total: number;
  status: InvoiceStatus;
  dueDate: string;
  paidDate: string;
  description: string;
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
