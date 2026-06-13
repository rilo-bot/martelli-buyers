import { QualificationStage, Property } from './models';

// Mirrors the prototype's DEFAULT_STAGES so a fresh DB starts with a sensible
// buyers-agency pipeline. Runs once when the collection is empty.
const DEFAULT_STAGES = [
  {
    label: 'Discovery Call',
    description: "Initial call to understand the buyer's needs and situation.",
    order: 0,
    color: 'cyan',
    checklistItems: [
      { id: 'dc-1', label: 'Call completed', description: 'Discovery call has taken place.', required: true, order: 0 },
      { id: 'dc-2', label: 'Budget confirmed', description: 'Buyer budget range established and recorded.', required: true, order: 1 },
      { id: 'dc-3', label: 'Property criteria captured', description: 'Suburb preferences, property type, bed/bath noted.', required: true, order: 2 },
      { id: 'dc-4', label: 'Pre-approval status noted', description: 'Finance pre-approval status confirmed with buyer.', required: false, order: 3 },
    ],
  },
  {
    label: 'In-Person Meeting',
    description: 'Face-to-face meeting to deepen the relationship and present services.',
    order: 1,
    color: 'violet',
    checklistItems: [
      { id: 'ipm-1', label: 'Meeting scheduled', description: 'In-person meeting time and location confirmed.', required: true, order: 0 },
      { id: 'ipm-2', label: 'Services presentation delivered', description: "Buyer's agency services, fees and process explained.", required: true, order: 1 },
      { id: 'ipm-3', label: 'Client questions addressed', description: 'All buyer questions noted and answered.', required: false, order: 2 },
      { id: 'ipm-4', label: 'Agreement discussion initiated', description: 'Buyer agency agreement terms introduced.', required: true, order: 3 },
    ],
  },
  {
    label: 'Paperwork',
    description: "Buyer's agency agreement and supporting documents sent for review.",
    order: 2,
    color: 'amber',
    checklistItems: [
      { id: 'pw-1', label: 'Agreement sent to buyer', description: "Buyer's agency agreement emailed for review.", required: true, order: 0 },
      { id: 'pw-2', label: 'ID verification complete', description: 'AML/ID documents collected and verified.', required: true, order: 1 },
      { id: 'pw-3', label: 'Fee structure confirmed', description: 'Engagement fee, success fee and GST agreed in writing.', required: true, order: 2 },
      { id: 'pw-4', label: 'Follow-up sent', description: 'Follow-up reminder sent if no response within 48 hours.', required: false, order: 3 },
    ],
  },
  {
    label: 'Signed Client',
    description: 'Agreement signed — buyer is now an active client.',
    order: 3,
    color: 'emerald',
    checklistItems: [
      { id: 'sc-1', label: 'Agreement signed and returned', description: 'Countersigned agreement received from buyer.', required: true, order: 0 },
      { id: 'sc-2', label: 'Engagement invoice issued', description: 'Xero engagement invoice created and sent.', required: true, order: 1 },
      { id: 'sc-3', label: 'Client portal access granted', description: 'Portal login sent to client.', required: false, order: 2 },
      { id: 'sc-4', label: 'Welcome email sent', description: 'Branded welcome email dispatched with next steps.', required: true, order: 3 },
    ],
  },
];

// Remap legacy property statuses to the new Buyer-Journey set. Idempotent —
// only matches the old values, so it's a no-op once everything is migrated.
const PROPERTY_STATUS_MIGRATION: Record<string, string> = {
  active: 'suggested',
  inspected: 'viewed',
  passed: 'rejected',
  offer_made: 'offer_placed',
};

async function migratePropertyStatuses(): Promise<void> {
  let migrated = 0;
  for (const [from, to] of Object.entries(PROPERTY_STATUS_MIGRATION)) {
    const res = await Property.updateMany({ status: from }, { $set: { status: to } });
    migrated += res.modifiedCount ?? 0;
  }
  if (migrated > 0) console.log(`[seed] migrated ${migrated} property statuses to the new set`);
}

export async function seedDefaults(): Promise<void> {
  await migratePropertyStatuses();

  const count = await QualificationStage.estimatedDocumentCount();
  if (count > 0) return;
  await QualificationStage.insertMany(DEFAULT_STAGES);
  console.log(`[seed] inserted ${DEFAULT_STAGES.length} default qualification stages`);
}
