import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { presignUpload, publicUrl, publicKey, keyFromUrl, deleteObject, hasS3 } from '../lib/s3';
import { asyncHandler } from '../middleware/error';

export const uploadsRouter = Router();

const signSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  scope: z.string().regex(/^[a-z0-9-]+$/i).default('misc'),
  scopeId: z.string().regex(/^[a-z0-9-]+$/i).optional(),
});

const deleteSchema = z.object({ url: z.string().url() });

// Documents accepted for DD evidence (LIM reports, titles, building reports).
const DOC_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

// Images/videos for property media; documents for DD evidence.
function isAllowed(contentType: string): boolean {
  return (
    contentType.startsWith('image/') ||
    contentType.startsWith('video/') ||
    DOC_TYPES.has(contentType)
  );
}

/** Safe file extension from a filename, falling back to the content-type subtype. */
function extFor(filename: string, contentType: string): string {
  const fromName = filename.includes('.') ? filename.split('.').pop()! : '';
  const raw = (fromName || contentType.split('/')[1] || 'bin').toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9]/g, '');
  return cleaned.slice(0, 8) || 'bin';
}

/** POST /api/uploads/sign — get a presigned PUT URL for a direct browser upload. */
uploadsRouter.post(
  '/sign',
  asyncHandler(async (req, res) => {
    const { filename, contentType, scope, scopeId } = signSchema.parse(req.body);
    if (!hasS3) {
      res.status(503).json({ error: 'File uploads are not configured on the server.' });
      return;
    }
    if (!isAllowed(contentType)) {
      res.status(400).json({ error: 'Only image, video and document files are allowed.' });
      return;
    }
    const key = publicKey(`${scope}/${scopeId ?? 'misc'}/${randomUUID()}.${extFor(filename, contentType)}`);
    const uploadUrl = await presignUpload({ key, contentType });
    res.json({ uploadUrl, publicUrl: publicUrl(key), key });
  }),
);

/** DELETE /api/uploads — remove an object by its public URL (best-effort). */
uploadsRouter.delete(
  '/',
  asyncHandler(async (req, res) => {
    const { url } = deleteSchema.parse(req.body);
    if (!hasS3) {
      res.status(503).json({ error: 'File uploads are not configured on the server.' });
      return;
    }
    const key = keyFromUrl(url);
    if (!key) {
      res.status(400).json({ error: 'URL does not belong to this storage bucket.' });
      return;
    }
    await deleteObject(key);
    res.json({ ok: true });
  }),
);
