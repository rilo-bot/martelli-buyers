import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { EmailTemplate, EmailCampaign } from '@/types';

const templatesApi = resource<EmailTemplate>('email-templates');
const campaignsApi = resource<EmailCampaign>('email-campaigns');

const DEFAULT_TEMPLATES: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>[] = [
  { name: 'Welcome - New Client', category: 'welcome', subject: 'Welcome to Martelli Buyers, {{clientName}}!', body: 'Dear {{clientName}},\n\nWelcome to Martelli Buyers. We are delighted to be working with you on your property search.\n\nWe have received your brief and our team is ready to begin the search immediately.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'consultantName'] },
  { name: 'Welcome - After Agreement Signed', category: 'welcome', subject: 'Your Buyer\'s Agency Agreement - Confirmed', body: 'Dear {{clientName}},\n\nThank you for signing your Buyer\'s Agency Agreement. We are now officially engaged and excited to find your perfect property.\n\nNext steps:\n1. We will begin scanning listings immediately\n2. You will receive your first property update within 48 hours\n3. We will schedule our weekly review call\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'consultantName', 'agreementDate'] },
  { name: 'Initial Invoice Sent', category: 'status_update', subject: 'Invoice for Buyer\'s Agency Services - {{invoiceNumber}}', body: 'Dear {{clientName}},\n\nPlease find attached your invoice for buyer\'s agency engagement services.\n\nInvoice Number: {{invoiceNumber}}\nAmount: {{amount}}\nDue Date: {{dueDate}}\n\nPlease feel free to reach out if you have any questions.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'invoiceNumber', 'amount', 'dueDate'] },
  { name: 'New Client Requirement - Agent Blast', category: 'requirement_blast', subject: 'New Buyer Requirement - {{suburb}} Area - {{budget}}', body: 'Dear {{agentName}},\n\nWe have a new buyer requirement that may suit your listings.\n\nBriefing:\n- Budget: {{budget}}\n- Property Type: {{propertyType}}\n- Bedrooms: {{bedrooms}}\n- Preferred Suburbs: {{suburbs}}\n- Key Requirements: {{requirements}}\n\nIf you have any suitable properties including off-market opportunities, please contact us.\n\nKind regards,\nMartelli Buyers Team', isActive: true, variables: ['agentName', 'budget', 'propertyType', 'bedrooms', 'suburbs', 'requirements'] },
  { name: 'Property Shortlist Update', category: 'status_update', subject: 'Property Shortlist Update - {{date}}', body: 'Dear {{clientName}},\n\nPlease find below your updated property shortlist as of {{date}}.\n\nWe have reviewed {{propertyCount}} properties this week. Please log in to your client portal to view full details and add any comments.\n\n{{propertyList}}\n\nLet us know if you would like to arrange inspections for any of these properties.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'date', 'propertyCount', 'propertyList'] },
  { name: 'Inspection Scheduled', category: 'status_update', subject: 'Property Inspection Confirmed - {{propertyAddress}}', body: 'Dear {{clientName}},\n\nYour property inspection has been confirmed:\n\nProperty: {{propertyAddress}}\nDate: {{inspectionDate}}\nTime: {{inspectionTime}}\nAgent: {{agentName}} ({{agentPhone}})\n\nPlease let us know if you need to reschedule.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'inspectionDate', 'inspectionTime', 'agentName', 'agentPhone'] },
  { name: 'Due Diligence Commenced', category: 'dd_request', subject: 'Due Diligence Started - {{propertyAddress}}', body: 'Dear {{clientName}},\n\nWe have commenced our due diligence process on {{propertyAddress}}.\n\nThis includes:\n- Council flood map review\n- Natural hazards assessment\n- Comparable sales analysis\n- Building and legal checks\n\nWe will provide you with a comprehensive report within 5-7 business days.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'consultantName'] },
  { name: 'DD Report Ready', category: 'dd_request', subject: 'Due Diligence Report Ready - {{propertyAddress}}', body: 'Dear {{clientName}},\n\nYour due diligence report for {{propertyAddress}} is now ready.\n\nKey findings:\n{{ddSummary}}\n\nPlease review the attached report and let us know if you have any questions or would like to discuss further.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'ddSummary'] },
  { name: 'Offer Preparation', category: 'status_update', subject: 'Preparing Offer - {{propertyAddress}}', body: 'Dear {{clientName}},\n\nFollowing your instruction, we are now preparing an offer for {{propertyAddress}}.\n\nOffer Details:\n- Offer Price: {{offerPrice}}\n- Conditions: {{conditions}}\n- Settlement: {{settlement}}\n\nWe will be in touch once the offer has been submitted.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'offerPrice', 'conditions', 'settlement'] },
  { name: 'Offer Accepted', category: 'status_update', subject: 'Congratulations! Your Offer Has Been Accepted - {{propertyAddress}}', body: 'Dear {{clientName}},\n\nCongratulations! Your offer on {{propertyAddress}} has been accepted.\n\nNext Steps:\n1. Contract signing\n2. Building and pest inspection\n3. Mortgage finalization\n4. Settlement preparation\n\nWe will coordinate with all parties to ensure a smooth settlement.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'consultantName'] },
  { name: 'Settlement Approaching', category: 'status_update', subject: 'Settlement Date Reminder - {{propertyAddress}}', body: 'Dear {{clientName}},\n\nThis is a reminder that settlement for {{propertyAddress}} is approaching.\n\nSettlement Date: {{settlementDate}}\nSettlement Amount: {{settlementAmount}}\n\nPlease ensure all funds are ready and contact your mortgage broker if needed.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'settlementDate', 'settlementAmount'] },
  { name: 'Settlement Complete', category: 'post_settlement', subject: 'Settlement Complete - Congratulations on Your New Property!', body: 'Dear {{clientName}},\n\nCongratulations! Settlement on {{propertyAddress}} has been completed successfully.\n\nYou are now the proud owner of your new property!\n\nWe have attached your final invoice. Thank you for choosing Martelli Buyers.\n\nWarm regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress'] },
  { name: 'Thank You - Referrer', category: 'thank_you', subject: 'Thank You for the Referral - {{clientName}}', body: 'Dear {{referrerName}},\n\nThank you for referring {{clientName}} to Martelli Buyers. We truly appreciate your confidence in our services.\n\nWe are now actively working with {{clientName}} on their property search and will ensure they receive our best service.\n\nWarm regards,\nMartelli Buyers Team', isActive: true, variables: ['referrerName', 'clientName'] },
  { name: 'Thank You - Agent Post-Settlement', category: 'thank_you', subject: 'Thank You - {{propertyAddress}} Settlement', body: 'Dear {{agentName}},\n\nThank you for your assistance with the sale of {{propertyAddress}}. It was a pleasure working with you and we look forward to future opportunities together.\n\nKind regards,\nMartelli Buyers Team', isActive: true, variables: ['agentName', 'propertyAddress'] },
  { name: 'Lawyer Introduction', category: 'status_update', subject: 'Introducing Our Client - {{clientName}}', body: 'Dear {{lawyerName}},\n\nI am writing to introduce our client, {{clientName}}, who is purchasing {{propertyAddress}}.\n\nContract details and key dates:\n- Contract Date: {{contractDate}}\n- Settlement Date: {{settlementDate}}\n\nPlease contact {{clientName}} directly to discuss conveyancing requirements.\n\nKind regards,\nMartelli Buyers Team', isActive: true, variables: ['lawyerName', 'clientName', 'propertyAddress', 'contractDate', 'settlementDate'] },
  { name: 'Mortgage Broker Introduction', category: 'status_update', subject: 'Offer Accepted - Mortgage Finalization Required', body: 'Dear {{brokerName}},\n\nOur client {{clientName}} has had their offer accepted on {{propertyAddress}}.\n\nSettlement Date: {{settlementDate}}\nPurchase Price: {{purchasePrice}}\n\nPlease contact {{clientName}} to finalize mortgage arrangements.\n\nKind regards,\nMartelli Buyers Team', isActive: true, variables: ['brokerName', 'clientName', 'propertyAddress', 'settlementDate', 'purchasePrice'] },
  { name: 'Weekly Search Update', category: 'status_update', subject: 'Your Weekly Property Search Update - Week {{weekNumber}}', body: 'Dear {{clientName}},\n\nHere is your weekly property search update.\n\nThis Week\'s Activity:\n- Properties reviewed: {{propertiesReviewed}}\n- Agent contacts made: {{agentContacts}}\n- Properties shortlisted: {{propertiesShortlisted}}\n\nUpcoming Inspections:\n{{upcomingInspections}}\n\nPlease log in to your portal to view full property details.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'weekNumber', 'propertiesReviewed', 'agentContacts', 'propertiesShortlisted', 'upcomingInspections'] },
  { name: 'AI Summary Consent Request', category: 'other', subject: 'AI Meeting Summary Consent - Your Privacy Matters', body: 'Dear {{clientName}},\n\nWe use AI-powered tools to generate meeting summaries and action items to ensure nothing is missed.\n\nWith your consent, we will use AI to summarize our calls and meetings. You can:\n- Review all summaries in your client portal\n- Revoke consent at any time\n- Request deletion of any summaries\n\nTo grant consent, please log in to your portal and update your preferences, or reply to this email.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName'] },
  { name: 'Property Visit Report', category: 'status_update', subject: 'Property Inspection Report - {{propertyAddress}}', body: 'Dear {{clientName}},\n\nPlease find below our inspection notes for {{propertyAddress}}.\n\nInspection Date: {{inspectionDate}}\n\nKey Observations:\n{{inspectionNotes}}\n\nPhotos have been uploaded to your client portal.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'inspectionDate', 'inspectionNotes'] },
  { name: 'Final Invoice', category: 'post_settlement', subject: 'Final Invoice - {{propertyAddress}} Settlement', body: 'Dear {{clientName}},\n\nPlease find attached your final invoice for buyer\'s agency services.\n\nInvoice Number: {{invoiceNumber}}\nProperty: {{propertyAddress}}\nAmount: {{amount}}\nDue Date: {{dueDate}}\n\nThank you for choosing Martelli Buyers. We hope you enjoy your new property!\n\nWarm regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'invoiceNumber', 'amount', 'dueDate'] },
  { name: 'Milestone Invoice', category: 'status_update', subject: 'Milestone Invoice - {{milestoneName}}', body: 'Dear {{clientName}},\n\nA milestone has been reached in your property search journey.\n\nMilestone: {{milestoneName}}\nInvoice Number: {{invoiceNumber}}\nAmount: {{amount}}\nDue Date: {{dueDate}}\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'milestoneName', 'invoiceNumber', 'amount', 'dueDate'] },
  { name: 'Off-Market Opportunity Alert', category: 'status_update', subject: 'Off-Market Property Opportunity - {{suburb}}', body: 'Dear {{clientName}},\n\nWe have identified an off-market property opportunity that may suit your brief.\n\nProperty Details:\n- Location: {{suburb}}\n- Price Guide: {{priceGuide}}\n- Type: {{propertyType}}\n- Bedrooms: {{bedrooms}}\n\nThis property is not publicly listed. Please log in to your portal for full details and let us know if you would like more information.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'suburb', 'priceGuide', 'propertyType', 'bedrooms'] },
  { name: 'Search Commencement', category: 'status_update', subject: 'Your Property Search Has Officially Commenced', body: 'Dear {{clientName}},\n\nYour property search is now officially underway!\n\nSearch Criteria:\n- Budget: {{budget}}\n- Property Type: {{propertyType}}\n- Preferred Suburbs: {{suburbs}}\n- Bedrooms: {{bedrooms}}\n\nWe have already begun reaching out to our network of {{agentCount}} agents. Expect your first update within 48 hours.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'budget', 'propertyType', 'suburbs', 'bedrooms', 'agentCount'] },
  { name: 'Requirement Blast Follow-Up', category: 'requirement_blast', subject: 'Following Up - New Buyer Requirement', body: 'Dear {{agentName}},\n\nI am following up on my recent email regarding a buyer requirement for {{suburb}} area.\n\nOur client has a budget of {{budget}} and is actively looking. They are flexible on timing and can move quickly.\n\nDo you have any suitable properties or upcoming listings?\n\nKind regards,\nMartelli Buyers Team', isActive: true, variables: ['agentName', 'suburb', 'budget'] },
  { name: 'Contract Exchange Notification', category: 'status_update', subject: 'Contracts Exchanged - {{propertyAddress}}', body: 'Dear {{clientName}},\n\nContracts have been successfully exchanged for {{propertyAddress}}.\n\nKey Dates:\n- Exchange Date: {{exchangeDate}}\n- Cooling Off End: {{coolingOffDate}}\n- Settlement Date: {{settlementDate}}\n\nWe will continue to monitor all key milestones through to settlement.\n\nBest regards,\nMartelli Buyers Team', isActive: true, variables: ['clientName', 'propertyAddress', 'exchangeDate', 'coolingOffDate', 'settlementDate'] },
];

interface EmailTemplatesState {
  templates: EmailTemplate[];
  campaigns: EmailCampaign[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addTemplate: (template: Omit<EmailTemplate, 'id' | 'createdAt' | 'updatedAt'>) => Promise<EmailTemplate>;
  updateTemplate: (id: string, updates: Partial<EmailTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  /** Append a campaign the server already persisted (via /api/email/blast). */
  recordSentCampaign: (campaign: EmailCampaign) => void;
  /** Server seeds nothing for templates — bulk-create the defaults if none exist yet. */
  seedDefaultTemplates: () => Promise<void>;
}

export const useEmailTemplatesStore = create<EmailTemplatesState>()((set, get) => ({
  templates: [],
  campaigns: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const [templates, campaigns] = await Promise.all([templatesApi.list(), campaignsApi.list()]);
      set({ templates, campaigns, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addTemplate: async (data) => {
    const template = await templatesApi.create(data);
    set((s) => ({ templates: [...s.templates, template] }));
    return template;
  },

  updateTemplate: async (id, updates) => {
    const updated = await templatesApi.update(id, updates);
    set((s) => ({ templates: s.templates.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteTemplate: async (id) => {
    await templatesApi.remove(id);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
  },

  recordSentCampaign: (campaign) => {
    set((s) => ({ campaigns: [...s.campaigns, campaign] }));
  },

  seedDefaultTemplates: async () => {
    if (get().templates.length > 0) return;
    const created = await Promise.all(DEFAULT_TEMPLATES.map((t) => templatesApi.create(t)));
    set({ templates: created });
  },
}));
