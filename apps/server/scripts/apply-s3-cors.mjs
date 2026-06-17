// Applies the bucket CORS rules in infra/s3-cors.json to the configured S3
// bucket, using the same AWS credentials the server uses. This is what allows
// the browser's presigned PUT (direct upload) to succeed — without it the
// browser blocks the request and the client shows "check your connection and
// S3 CORS".
//
//   node scripts/apply-s3-cors.mjs          # apply, then print the live config
//   node scripts/apply-s3-cors.mjs --check  # only print the live config
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  S3Client,
  PutBucketCorsCommand,
  GetBucketCorsCommand,
} from '@aws-sdk/client-s3';

const here = dirname(fileURLToPath(import.meta.url));
const corsPath = resolve(here, '../../../infra/s3-cors.json');

const region = process.env.AWS_REGION;
const bucket = process.env.S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

if (!region || !bucket || !accessKeyId || !secretAccessKey) {
  console.error('Missing AWS_REGION / S3_BUCKET / AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in apps/server/.env');
  process.exit(1);
}

const client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
const checkOnly = process.argv.includes('--check');

try {
  if (!checkOnly) {
    const CORSRules = JSON.parse(readFileSync(corsPath, 'utf8'));
    await client.send(new PutBucketCorsCommand({ Bucket: bucket, CORSConfiguration: { CORSRules } }));
    console.log(`✓ Applied CORS to s3://${bucket} (${region})`);
  }
  const live = await client.send(new GetBucketCorsCommand({ Bucket: bucket }));
  console.log('Live CORS rules:');
  console.log(JSON.stringify(live.CORSRules, null, 2));
} catch (err) {
  console.error('✗ Failed:', err?.name, '-', err?.message);
  if (err?.name === 'AccessDenied') {
    console.error('  The IAM user needs s3:PutBucketCors (and s3:GetBucketCors) on this bucket.');
  }
  process.exit(1);
}
