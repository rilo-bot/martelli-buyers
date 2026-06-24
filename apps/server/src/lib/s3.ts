import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env, hasS3 } from '../env';

let client: S3Client | null = null;
function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3.region,
      credentials: { accessKeyId: env.S3.accessKeyId, secretAccessKey: env.S3.secretAccessKey },
    });
  }
  return client;
}

/** The bucket's own regional S3 origin (used to recognise legacy stored URLs). */
function s3Origin(): string {
  return `https://${env.S3.bucket}.s3.${env.S3.region}.amazonaws.com`;
}

/** Per-segment encode/decode so keys containing slashes round-trip in a URL path. */
function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}
function decodeKey(path: string): string {
  return path
    .split('/')
    .map((seg) => { try { return decodeURIComponent(seg); } catch { return seg; } })
    .join('/');
}

/**
 * Place a logical key under the bucket's public-read prefix (if one is
 * configured). All keys we intend to serve publicly must go through this so the
 * stored object actually matches the bucket policy's public GET grant.
 */
export function publicKey(key: string): string {
  const prefix = env.S3.publicPrefix;
  return prefix ? `${prefix}/${key}` : key;
}

/**
 * Permanent URL for a stored object. When a CDN/custom domain is configured
 * (S3_PUBLIC_BASE_URL) we serve straight from it. Otherwise the bucket is
 * private, so we route the object through this API's public image proxy
 * (/api/files/<key>), which streams it with the server's own credentials — no
 * public bucket policy required. The proxy only serves images, so non-image
 * uploads (catalogued documents) stay private behind the authenticated routes.
 */
export function publicUrl(key: string): string {
  const cdn = env.S3.publicBaseUrl.trim().replace(/\/+$/, '');
  if (cdn) return `${cdn}/${encodeKey(key)}`;
  return `${env.SERVER_PUBLIC_URL}/api/files/${encodeKey(key)}`;
}

/**
 * Recover the object key from any URL `publicUrl` may have produced — the image
 * proxy, a configured CDN, or a legacy raw-S3 URL (for records saved before the
 * proxy). Returns '' if the URL doesn't belong to us.
 */
export function keyFromUrl(url: string): string {
  const bases = [
    `${env.SERVER_PUBLIC_URL}/api/files`,
    env.S3.publicBaseUrl.trim().replace(/\/+$/, ''),
    s3Origin(),
  ].filter(Boolean);
  for (const base of bases) {
    const prefix = `${base}/`;
    if (url.startsWith(prefix)) return decodeKey(url.slice(prefix.length));
  }
  return '';
}

/** Decode an /api/files/<key> path segment back into an S3 object key. */
export function keyFromProxyPath(path: string): string {
  return decodeKey(path.replace(/^\/+/, ''));
}

/**
 * Rewrite a stored asset URL to its current public form. Records saved before
 * the image proxy hold a raw-S3 (or old-CDN) URL; this maps them onto the proxy
 * URL so existing logos/photos resolve without a re-upload. Empty, data:, or
 * foreign URLs pass through unchanged. Idempotent.
 */
export function normalizeAssetUrl(url: string): string {
  if (!url) return url;
  const key = keyFromUrl(url);
  return key ? publicUrl(key) : url;
}

/**
 * Rewrite embedded asset URLs (img `src`, link `href`) within a block of HTML to
 * their current public form. Logos/images saved into rich text before the image
 * proxy hold raw-S3 URLs; this maps them onto the proxy so they resolve in the
 * editor, the PDF and email. Non-asset URLs are left untouched. Idempotent.
 */
export function normalizeHtmlAssetUrls(html: string): string {
  if (!html) return html;
  return html.replace(/((?:src|href)=")([^"]+)(")/gi, (match, pre, url, post) => {
    const next = normalizeAssetUrl(url);
    return next === url ? match : `${pre}${next}${post}`;
  });
}

/** Presigned PUT URL for a direct browser → S3 upload (~5 min). */
export async function presignUpload(opts: { key: string; contentType: string }): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: env.S3.bucket,
    Key: opts.key,
    ContentType: opts.contentType,
  });
  return getSignedUrl(s3(), cmd, { expiresIn: 300 });
}

/**
 * Presigned GET URL for a private object (~5 min). Lets the browser fetch a file
 * the bucket does NOT serve publicly — the signature carries our IAM read grant,
 * so it works regardless of bucket policy / key prefix. `download: true` forces
 * a save dialog; otherwise the browser previews inline (PDFs, images). When a
 * filename is given, S3 overrides Content-Disposition so the saved file is named
 * sensibly instead of the opaque UUID key.
 */
export async function presignDownload(
  key: string,
  opts: { filename?: string; download?: boolean } = {},
): Promise<string> {
  const disposition = opts.download ? 'attachment' : 'inline';
  const safeName = opts.filename?.replace(/["\\\r\n]/g, '').trim();
  const cmd = new GetObjectCommand({
    Bucket: env.S3.bucket,
    Key: key,
    ...(safeName ? { ResponseContentDisposition: `${disposition}; filename="${safeName}"` } : {}),
  });
  return getSignedUrl(s3(), cmd, { expiresIn: 300 });
}

/**
 * Fetch a private object's bytes through the server (NOT presigned). Lets the
 * API proxy a file inline for preview without ever handing the client a
 * directly-saveable S3 URL. The returned `body` is a Node Readable to pipe to
 * the response.
 */
export async function getObjectStream(
  key: string,
): Promise<{ body: NodeJS.ReadableStream; contentType?: string; contentLength?: number }> {
  const out = await s3().send(new GetObjectCommand({ Bucket: env.S3.bucket, Key: key }));
  return {
    body: out.Body as unknown as NodeJS.ReadableStream,
    contentType: out.ContentType,
    contentLength: out.ContentLength,
  };
}

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3.bucket, Key: key }));
}

export { hasS3 };
