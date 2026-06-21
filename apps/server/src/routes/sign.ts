import { Router } from 'express';
import { z } from 'zod';
import { Deal } from '../models';
import { asyncHandler } from '../middleware/error';
import { renderAgreementPdf } from '../lib/pdf/agreementHtml';
import { getCompanySettingsDto } from '../lib/companySettings';
import { recordEvent } from '../lib/audit';
import { hasS3, env } from '../env';

/**
 * Public, token-scoped agreement e-signing. Mounted BEFORE the auth gate so a
 * client can sign without a Martelli login. The token is the only credential.
 */
export const signRouter = Router();

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

/** GET /api/sign/:token — minimal deal info to render the signing page. */
signRouter.get(
  '/:token',
  asyncHandler(async (req, res) => {
    const deal = await Deal.findOne({ agreementSignToken: req.params.token });
    if (!deal) {
      res.status(404).json({ error: 'This signing link is invalid or has expired.' });
      return;
    }
    res.json({
      clientName: deal.clientName,
      propertyType: deal.propertyType,
      budget: deal.budget,
      fee: deal.fee,
      feeType: deal.feeType,
      agreementStatus: deal.agreementStatus,
      signerName: deal.agreementSignerName,
      signedAt: deal.agreementSignedAt,
    });
  }),
);

/** GET /api/sign/:token/agreement.pdf — the agreement PDF for this token. */
signRouter.get(
  '/:token/agreement.pdf',
  asyncHandler(async (req, res) => {
    const deal = await Deal.findOne({ agreementSignToken: req.params.token });
    if (!deal) {
      res.status(404).json({ error: 'Invalid signing link.' });
      return;
    }
    const buf = await renderAgreementPdf(deal.toJSON() as never, { signed: deal.agreementStatus === 'signed' }, await getCompanySettingsDto());
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

/** POST /api/sign/:token — record the signature. */
signRouter.post(
  '/:token',
  asyncHandler(async (req, res) => {
    const deal = await Deal.findOne({ agreementSignToken: req.params.token });
    if (!deal) {
      res.status(404).json({ error: 'This signing link is invalid or has expired.' });
      return;
    }
    if (deal.agreementStatus === 'signed') {
      res.json({ ok: true, alreadySigned: true, signerName: deal.agreementSignerName, signedAt: deal.agreementSignedAt });
      return;
    }
    const { signerName, signatureImage } = signSchema.parse(req.body);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';

    deal.set('agreementSignerName', signerName);
    deal.set('agreementSignedAt', new Date().toISOString());
    deal.set('agreementSignerIp', ip);
    if (signatureImage) deal.set('agreementSignatureImage', signatureImage);
    deal.set('agreementStatus', 'signed');

    // Best-effort: archive the signed PDF to S3 when storage is configured.
    if (hasS3) {
      try {
        const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
        const { env } = await import('../env');
        const { publicUrl, publicKey } = await import('../lib/s3');
        const buf = await renderAgreementPdf(deal.toJSON() as never, { signed: true }, await getCompanySettingsDto());
        const key = publicKey(`agreements/${deal.id}/signed-agreement.pdf`);
        const client = new S3Client({
          region: env.S3.region,
          credentials: { accessKeyId: env.S3.accessKeyId, secretAccessKey: env.S3.secretAccessKey },
        });
        await client.send(new PutObjectCommand({ Bucket: env.S3.bucket, Key: key, Body: buf, ContentType: 'application/pdf' }));
        deal.set('agreementUrl', publicUrl(key));
      } catch (err) {
        console.warn('[sign] failed to archive signed agreement to S3 —', (err as Error).message);
      }
    }

    await deal.save();
    await recordEvent({
      entityType: 'deal', entityId: deal.id, dealId: deal.id,
      action: 'agreement_signed', field: 'agreementStatus', fromValue: 'sent', toValue: 'signed',
      actor: { id: '', name: signerName },
    });
    res.json({ ok: true, signerName: deal.agreementSignerName, signedAt: deal.agreementSignedAt });
  }),
);
