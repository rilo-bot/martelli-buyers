import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';

export const env = {
  NODE_ENV,
  isProd: NODE_ENV === 'production',
  PORT: Number(process.env.PORT ?? 3001),
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  MONGODB_URI: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/rilo'),
  SESSION_SECRET: required('SESSION_SECRET', 'dev-insecure-secret-change-me'),
  OTP_TTL_MIN: Number(process.env.OTP_TTL_MIN ?? 10),
  EMAIL: {
    // SendGrid Web API (HTTPS) — works on hosts that block SMTP ports (e.g.
    // Render free tier). Falls back to the legacy SMTP_* names so existing
    // .env files keep working (SMTP_PASS held the SendGrid key).
    apiKey: process.env.SENDGRID_API_KEY ?? process.env.SMTP_PASS ?? '',
    from: process.env.EMAIL_FROM ?? process.env.SMTP_FROM ?? 'Martelli Buyers <no-reply@martelli.example>',
  },
  AI: {
    // Gemini via OpenRouter (Vercel AI SDK). Key stays server-side.
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    model: process.env.OPENROUTER_MODEL ?? 'google/gemini-2.5-flash',
  },
  S3: {
    region: process.env.AWS_REGION ?? '',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    bucket: process.env.S3_BUCKET ?? '',
    // Optional CDN/custom domain; defaults to the bucket's regional URL.
    publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
  },
};

/** True when a SendGrid API key is configured; otherwise dev logs instead of sending. */
export const hasEmail = Boolean(env.EMAIL.apiKey);

/** True when an OpenRouter key is configured for AI features. */
export const hasAi = Boolean(env.AI.apiKey);

/** True when S3 credentials + bucket are configured for uploads. */
export const hasS3 = Boolean(
  env.S3.region && env.S3.accessKeyId && env.S3.secretAccessKey && env.S3.bucket,
);
