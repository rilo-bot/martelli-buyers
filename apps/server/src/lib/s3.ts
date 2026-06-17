import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
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

/** Base URL objects are publicly served from (CDN/custom domain or the bucket's regional URL). */
function baseUrl(): string {
  const custom = env.S3.publicBaseUrl.trim().replace(/\/+$/, '');
  if (custom) return custom;
  return `https://${env.S3.bucket}.s3.${env.S3.region}.amazonaws.com`;
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

/** Permanent public URL for a stored object (bucket policy grants public read). */
export function publicUrl(key: string): string {
  return `${baseUrl()}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** Recover the object key from a public URL (for deletes). Returns '' if it doesn't belong to us. */
export function keyFromUrl(url: string): string {
  const prefix = `${baseUrl()}/`;
  if (!url.startsWith(prefix)) return '';
  return url
    .slice(prefix.length)
    .split('/')
    .map((seg) => decodeURIComponent(seg))
    .join('/');
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

export async function deleteObject(key: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: env.S3.bucket, Key: key }));
}

export { hasS3 };
