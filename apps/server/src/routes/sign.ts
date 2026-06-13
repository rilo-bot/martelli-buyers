import { Router } from 'express';
import { z } from 'zod';
import { Deal } from '../models';
import { asyncHandler } from '../middleware/error';
import { buildAgreementPdf } from '../lib/pdf/agreement';
import { recordEvent } from '../lib/audit';
import { hasS3 } from '../env';

/**
 * Public, token-scoped agreement e-signing. Mounted BEFORE the auth gate so a
 * client can sign without a Martelli login. The token is the only credential.
 */
export const signRouter = Router();

const signSchema = z.object({
  signerName: z.string().min(2).max(120),
  agree: z.literal(true),
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
    const buf = await buildAgreementPdf(deal.toJSON() as never, { signed: deal.agreementStatus === 'signed' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="agency-agreement.pdf"');
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
    const { signerName } = signSchema.parse(req.body);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || '';

    deal.set('agreementSignerName', signerName);
    deal.set('agreementSignedAt', new Date().toISOString());
    deal.set('agreementSignerIp', ip);
    deal.set('agreementStatus', 'signed');

    // Best-effort: archive the signed PDF to S3 when storage is configured.
    if (hasS3) {
      try {
        const { PutObjectCommand, S3Client } = await import('@aws-sdk/client-s3');
        const { env } = await import('../env');
        const { publicUrl } = await import('../lib/s3');
        const buf = await buildAgreementPdf(deal.toJSON() as never, { signed: true });
        const key = `agreements/${deal.id}/signed-agreement.pdf`;
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
