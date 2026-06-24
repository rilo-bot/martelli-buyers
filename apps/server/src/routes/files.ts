import { Router } from 'express';
import { getObjectStream, keyFromProxyPath, hasS3 } from '../lib/s3';
import { asyncHandler } from '../middleware/error';

/**
 * Public image proxy. Streams an uploaded object from the (private) S3 bucket
 * using the server's own credentials, so embedded assets — logos, property
 * photos, avatars — resolve in the app, in generated PDFs and in outbound
 * emails without the bucket ever being made publicly readable.
 *
 * Mounted BEFORE the auth gate (mail clients and headless Chromium have no
 * session). To keep private catalogued documents (LIM reports, contracts, etc.)
 * gated behind the authenticated /api/documents routes, this endpoint serves
 * IMAGES ONLY — any non-image object is treated as not found. Keys are random
 * UUIDs, so objects are not enumerable.
 */
export const filesRouter = Router();

filesRouter.get(
  '/*',
  asyncHandler(async (req, res) => {
    if (!hasS3) {
      res.status(404).end();
      return;
    }
    const key = keyFromProxyPath((req.params as Record<string, string>)[0] ?? '');
    if (!key) {
      res.status(404).end();
      return;
    }

    let obj: Awaited<ReturnType<typeof getObjectStream>>;
    try {
      obj = await getObjectStream(key);
    } catch {
      // Missing key / access error — don't leak which.
      res.status(404).end();
      return;
    }

    const contentType = obj.contentType ?? '';
    if (!contentType.startsWith('image/')) {
      // Only images are public; everything else stays behind the auth routes.
      (obj.body as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
      res.status(404).end();
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Allow the asset to be embedded from the web app's (different) origin and
    // override Helmet's default same-origin resource policy.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (obj.contentLength) res.setHeader('Content-Length', obj.contentLength);
    obj.body.pipe(res);
  }),
);
