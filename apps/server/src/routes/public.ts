import { Router } from 'express';
import { asyncHandler } from '../middleware/error';
import { ContactEnquiry } from '../models';

export const publicRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim + hard-cap a free-text field so the public form can't store huge blobs. */
function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

/**
 * Public website contact form → CRM contact enquiry.
 *
 * Unauthenticated by design: it's mounted before the session gate so prospective
 * buyers on the marketing site can submit. Every submission becomes a
 * ContactEnquiry with status 'new' and source 'Website' — it lands in the team's
 * Enquiries inbox (NOT the qualified Leads pipeline) so the public form can't
 * flood leads. Staff review each enquiry and convert the worthwhile ones into a
 * Lead from there. Inputs are validated and length-capped to keep the endpoint
 * from being used to store arbitrary data.
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

    const enquiry = await ContactEnquiry.create({
      name,
      email,
      phone,
      enquiryType,
      budget,
      location,
      message,
      consent,
      source: 'Website',
      status: 'new',
    });

    // Return only a minimal acknowledgement — never echo CRM internals publicly.
    res.status(201).json({ ok: true, id: enquiry.id });
  }),
);
