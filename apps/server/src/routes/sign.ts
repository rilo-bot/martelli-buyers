import { Router } from 'express';
import { z } from 'zod';
import { Deal, Lead } from '../models';
import { asyncHandler } from '../middleware/error';
import { renderAgreementPdf } from '../lib/pdf/agreementHtml';
import { getCompanySettingsDto } from '../lib/companySettings';
import { recordEvent } from '../lib/audit';
import { hasS3, env } from '../env';

/**
 * Public, token-scoped agreement e-signing. Mounted BEFORE the auth gate so a
 * buyer can sign without a Martelli login. The token is the only credential.
 *
 * The buyer's agency agreement is signed during the LEAD phase, so a token
 * normally resolves to a Lead; deals are still supported for agreements created
 * before agreements moved to the lead.
 */
export const signRouter = Router();

type Kind = 'lead' | 'deal';
interface Subject { kind: Kind; doc: InstanceType<typeof Lead> | InstanceType<typeof Deal>; }

/** Resolve a signing token to its Lead (preferred) or Deal. */
async function findSubject(token: string): Promise<Subject | null> {
  const lead = await Lead.findOne({ agreementSignToken: token });
  if (lead) return { kind: 'lead', doc: lead };
  const deal = await Deal.findOne({ agreementSignToken: token });
  if (deal) return { kind: 'deal', doc: deal };
  return null;
}

/** Full name on the agreement, for either kind. */
function clientNameOf(s: Subject): string {
  if (s.kind === 'deal') return s.doc.get('clientName') || '';
  return `${s.doc.get('firstName') ?? ''} ${s.doc.get('lastName') ?? ''}`.trim();
}

/** Build the deal-shaped object the PDF builder expects, for either kind. */
function pdfSubject(s: Subject): Record<string, unknown> {
  const base = s.doc.toJSON() as Record<string, unknown>;
  if (s.kind === 'deal') return base;
  return {
    ...base,
    clientName: clientNameOf(s),
    clientEmail: s.doc.get('email') ?? '',
    clientPhone: s.doc.get('phone') ?? '',
    brief: s.doc.get('notes') ?? '',
    fee: 0,
    feeType: '',
  };
}

const signSchema = z.object({
  signerName: z.string().min(2).max(120),
  agree: z.literal(true),
  // Optional drawn signature: a PNG data URL. Capped at ~1MB to keep the
  // document (and the Mongo record) small. Omitted when the buyer typed instead.
  signatureImage: z
    .string()
    .regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'Signature must be a PNG image.')
    .max(1_500_000)
    .optional(),
});

/** GET /api/sign/:token — minimal info to render the signing page. */
signRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const s = await findSubject(req.params.token);
    if (!s) {
      res.status(404).json({ error: 'This signing link is invalid or has expired.' });
      return;
    }
    res.json({
      clientName: clientNameOf(s),
      propertyType: s.doc.get('propertyType'),
      budget: s.doc.get('budget'),
      fee: s.kind === 'deal' ? s.doc.get('fee') : 0,
      feeType: s.kind === 'deal' ? s.doc.get('feeType') : '',
      agreementStatus: s.doc.get('agreementStatus'),
      signerName: s.doc.get('agreementSignerName'),
      signedAt: s.doc.get('agreementSignedAt'),
    });
  }),
);

/** GET /api/sign/:token/agreement.pdf — the agreement PDF for this token. */
signRouter.get(
  '/:token/agreement.pdf',
  asyncHandler(async (req, res) => {
    const s = await findSubject(req.params.token);
    if (!s) {
      res.status(404).json({ error: 'Invalid signing link.' });
      return;
    }
    const buf = await renderAgreementPdf(
      pdfSubject(s) as never,
      { signed: s.doc.get('agreementStatus') === 'signed' },
      await getCompanySettingsDto(),
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="agency-agreement.pdf"');
    // The signing page embeds this PDF in an iframe. In prod the web app and API
    // live on different origins, so override Helmet's same-origin framing defaults
    // (X-Frame-Options / CSP frame-ancestors) for this one public, embeddable PDF.
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', `frame-ancestors 'self' ${env.CLIENT_ORIGIN}`);
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  }),
);

/** Best-effort: archive the signed PDF to S3 and return its URL ('' on failure). */
async function archiveSignedPdf(s: Subject, settings: Awaited<ReturnType<typeof getCompanySettingsDto>>): Promise<string> {
  if (!hasS3) return '';
  try {
    const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
    const { publicUrl, publicKey } = await import('../lib/s3');
    const buf = await renderAgreementPdf(pdfSubject(s) as never, { signed: true }, settings);
    const scope = s.kind === 'deal' ? s.doc.id : `lead-${s.doc.id}`;
    const key = publicKey(`agreements/${scope}/signed-agreement.pdf`);
    const client = new S3Client({
      region: env.S3.region,
      credentials: { accessKeyId: env.S3.accessKeyId, secretAccessKey: env.S3.secretAccessKey },
    });
    await client.send(new PutObjectCommand({ Bucket: env.S3.bucket, Key: key, Body: buf, ContentType: 'application/pdf' }));
    return publicUrl(key);
  } catch (err) {
    console.warn('[sign] failed to archive signed agreement to S3 —', (err as Error).message);
    return '';
  }
}

/** POST /api/sign/:token — record the signature. */
signRouter.post(
  '/:token',
  asyncHandler(async (req, res) => {
    const s = await findSubject(req.params.token);
    if (!s) {
      res.status(404).json({ error: 'This signing link is invalid or has expired.' });
      return;
    }
    const { doc } = s;
    if (doc.get('agreementStatus') === 'signed') {
      res.json({ ok: true, alreadySigned: true, signerName: doc.get('agreementSignerName'), signedAt: doc.get('agreementSignedAt') });
      return;
    }
    const { signerName, signatureImage } = signSchema.parse(req.body);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';
    const prevStatus = doc.get('agreementStatus');

    doc.set('agreementSignerName', signerName);
    doc.set('agreementSignedAt', new Date().toISOString());
    doc.set('agreementSignerIp', ip);
    if (signatureImage) doc.set('agreementSignatureImage', signatureImage);
    doc.set('agreementStatus', 'signed');

    const archivedUrl = await archiveSignedPdf(s, await getCompanySettingsDto());
    if (archivedUrl) doc.set('agreementUrl', archivedUrl);

    await doc.save();

    // Deals live on a Buyer Journey timeline; leads don't (yet).
    if (s.kind === 'deal') {
      await recordEvent({
        entityType: 'deal', entityId: doc.id, dealId: doc.id,
        action: 'agreement_signed', field: 'agreementStatus', fromValue: prevStatus, toValue: 'signed',
        actor: { id: '', name: signerName },
      });
    }

    res.json({ ok: true, signerName: doc.get('agreementSignerName'), signedAt: doc.get('agreementSignedAt') });
  }),
);
