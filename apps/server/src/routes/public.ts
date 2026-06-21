import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { Lead } from '../models';

export const publicRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim + hard-cap a free-text field so the public form can't store huge blobs. */
function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/** Split "Jane Mary Smith" → { firstName: 'Jane', lastName: 'Mary Smith' }. */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Public website contact form → CRM lead.
 *
 * Unauthenticated by design: it's mounted before the session gate so prospective
 * buyers on the marketing site can submit. Every submission becomes a Lead with
 * status 'new' and source 'Website', so it lands in the team's Leads inbox with
 * the full enquiry preserved in the notes. Inputs are validated and length-capped
 * to keep the endpoint from being used to store arbitrary data.
 */
publicRouter.post(
  '/contact',
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    const name = clean(body.name, 120);
    const email = clean(body.email, 160).toLowerCase();
    const phone = clean(body.phone, 40);
    const enquiryType = clean(body.enquiryType, 80);
    const budget = clean(body.budget, 40);
    const location = clean(body.location, 120);
    const message = clean(body.message, 4000);
    const consent = body.consent === true;

    // Mirror the client-side validation so a crafted request can't bypass it.
    if (!name) {
      res.status(400).json({ error: 'Name is required.' });
      return;
    }
    if (!EMAIL_RE.test(email)) {
      res.status(400).json({ error: 'A valid email is required.' });
      return;
    }
    if (!message) {
      res.status(400).json({ error: 'Message is required.' });
      return;
    }
    if (!consent) {
      res.status(400).json({ error: 'Consent is required.' });
      return;
    }

    const { firstName, lastName } = splitName(name);

    // Capture every submitted field in the notes so nothing the prospect typed is
    // lost, even where the Lead schema has no dedicated column (enquiry type,
    // budget range, consent).
    const headers = [
      enquiryType && `Enquiry type: ${enquiryType}`,
      budget && `Budget range: ${budget}`,
      location && `Preferred location: ${location}`,
    ].filter((line): line is string => Boolean(line));

    const notes = [
      ...headers,
      headers.length ? '' : undefined,
      message,
      '',
      '— Submitted via website contact form (consent given).',
    ]
      .filter((line): line is string => line !== undefined)
      .join('\n');

    const lead = await Lead.create({
      firstName,
      lastName,
      email,
      phone,
      source: 'Website',
      status: 'new',
      notes,
      // Keep the preferred location searchable on the lead too.
      preferredSuburbs: location ? [location] : [],
    });

    // Return only a minimal acknowledgement — never echo CRM internals publicly.
    res.status(201).json({ ok: true, id: lead.id });
  }),
);
