import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { requirePermission } from '../lib/permissions';
import { ContactEnquiry, Lead } from '../models';

export const enquiriesRouter = Router();

/** Split "Jane Mary Smith" → { firstName: 'Jane', lastName: 'Mary Smith' }. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = (full ?? '').split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Build the Lead notes block from an enquiry, preserving every field the
 * prospect typed even where the Lead schema has no dedicated column (enquiry
 * type, budget range, consent).
 */
function buildNotes(enquiry: {
  enquiryType: string;
  budget: string;
  location: string;
  message: string;
}): string {
  const headers = [
    enquiry.enquiryType && `Enquiry type: ${enquiry.enquiryType}`,
    enquiry.budget && `Budget range: ${enquiry.budget}`,
    enquiry.location && `Preferred location: ${enquiry.location}`,
  ].filter((line): line is string => Boolean(line));

  return [
    ...headers,
    headers.length ? '' : undefined,
    enquiry.message,
    '',
    '— Converted from a website contact enquiry (consent given).',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n');
}

/**
 * Convert a contact enquiry into a qualified Lead.
 *
 * This is the manual review step: website submissions land as enquiries, and a
 * staff member promotes the worthwhile ones into the Leads pipeline. The
 * operation is idempotent — re-running on an already-converted enquiry returns
 * the existing Lead instead of creating a duplicate. Returns both records so the
 * client can sync its Enquiries and Leads stores from authoritative server state.
 */
enquiriesRouter.post(
  '/:id/convert',
  requirePermission('enquiries:edit'),
  asyncHandler(async (req, res) => {
    const enquiry = await ContactEnquiry.findById(req.params.id);
    if (!enquiry) {
      res.status(404).json({ error: 'Enquiry not found.' });
      return;
    }

    // Idempotent: if it was already converted and the lead still exists, return it.
    if (enquiry.get('status') === 'converted' && enquiry.get('convertedLeadId')) {
      const existing = await Lead.findById(enquiry.get('convertedLeadId'));
      if (existing) {
        res.json({ enquiry: enquiry.toJSON(), lead: existing.toJSON(), leadCreated: false });
        return;
      }
    }

    const { firstName, lastName } = splitName(enquiry.get('name'));
    const location = enquiry.get('location') as string;

    const lead = await Lead.create({
      firstName,
      lastName,
      email: enquiry.get('email'),
      phone: enquiry.get('phone'),
      source: enquiry.get('source') || 'Website',
      status: 'new',
      notes: buildNotes({
        enquiryType: enquiry.get('enquiryType'),
        budget: enquiry.get('budget'),
        location,
        message: enquiry.get('message'),
      }),
      // Keep the preferred location searchable on the lead too.
      preferredSuburbs: location ? [location] : [],
      assignedTo: enquiry.get('assignedTo') ?? '',
    });

    enquiry.set({ status: 'converted', convertedLeadId: lead.id });
    await enquiry.save();

    res.status(201).json({ enquiry: enquiry.toJSON(), lead: lead.toJSON(), leadCreated: true });
  }),
);
