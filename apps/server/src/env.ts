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
  // Public origin of THIS API server. Used to build absolute URLs for assets
  // streamed through the image proxy (/api/files) so they resolve in the app,
  // in generated PDFs (fetched by headless Chromium) and in outbound emails.
  // Defaults to localhost for dev; set to the deployed API origin in production.
  // A scheme-less value (e.g. Render's bare `host`) is assumed https.
  SERVER_PUBLIC_URL: (() => {
    const raw = (process.env.SERVER_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3001}`).trim().replace(/\/+$/, '');
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  })(),
  MONGODB_URI: required('MONGODB_URI', 'mongodb://127.0.0.1:27017/rilo'),
  SESSION_SECRET: required('SESSION_SECRET', 'dev-insecure-secret-change-me'),
  OTP_TTL_MIN: Number(process.env.OTP_TTL_MIN ?? 10),
  // The single super-admin account (by email). Always has every permission,
  // cannot be locked out, and is the only account that may create/edit roles.
  SUPER_ADMIN_EMAIL: (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase(),
  // How long an invite link stays valid before it must be re-sent.
  INVITE_TTL_DAYS: Number(process.env.INVITE_TTL_DAYS ?? 7),
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
    // Key prefix under which objects are publicly readable. Leave blank for a
    // dedicated bucket whose policy grants public read on the app's own
    // prefixes. Set to e.g. "public" when sharing a bucket whose policy only
    // exposes a "public/*" prefix — uploaded keys are stored beneath it.
    publicPrefix: (process.env.S3_PUBLIC_PREFIX ?? '').replace(/^\/+|\/+$/g, ''),
  },
  REMINDERS: {
    // Automated overdue-invoice reminders (only run when email is configured).
    // Days between reminders for one invoice; max reminders per invoice; how
    // often the scheduler scans.
    intervalDays: Number(process.env.INVOICE_REMINDER_INTERVAL_DAYS ?? 3),
    max: Number(process.env.INVOICE_REMINDER_MAX ?? 3),
    scanHours: Number(process.env.INVOICE_REMINDER_SCAN_HOURS ?? 12),
  },
  XERO: {
    // OAuth 2.0 app credentials. Until both are set, "Send to Xero" stays
    // gated ("Not configured") in the UI.
    clientId: process.env.XERO_CLIENT_ID ?? '',
    clientSecret: process.env.XERO_CLIENT_SECRET ?? '',
    // Must exactly match a redirect URI registered in the Xero app.
    redirectUri: process.env.XERO_REDIRECT_URI ?? 'http://localhost:3001/api/xero/callback',
    // Signing key for the Xero "Invoices" webhook (status sync).
    webhookKey: process.env.XERO_WEBHOOK_KEY ?? '',
    // NZ defaults — revenue account code + GST tax type on pushed invoices.
    salesAccountCode: process.env.XERO_SALES_ACCOUNT_CODE ?? '200',
    taxType: process.env.XERO_TAX_TYPE ?? 'OUTPUT2',
    // Space-separated OAuth scopes. Must match the scopes enabled on the Xero
    // app exactly (apps now use granular scopes, e.g. accounting.invoices).
    scopes: process.env.XERO_SCOPES
      ?? 'openid profile email accounting.transactions accounting.contacts offline_access',
  },
  MEET: {
    // RILO Meet external API (video meetings). The key is server-side only and
    // is forwarded as the `x-rilo-meet-key` header — never exposed to the client.
    // While the key is blank, the Meet page stays gated ("Not configured").
    apiKey: process.env.RILO_MEET_API_KEY ?? '',
    baseUrl: (process.env.RILO_MEET_BASE_URL ?? 'https://decoded-studios-api.onrender.com').replace(/\/+$/, ''),
  },
  MICROSOFT: {
    // Microsoft Graph OAuth 2.0 app (Entra/Azure AD) for the Outlook email sync.
    // Until both id+secret are set, the Outlook card stays "Not configured".
    clientId: process.env.MS_CLIENT_ID ?? '',
    clientSecret: process.env.MS_CLIENT_SECRET ?? '',
    // 'common' = work + personal accounts; use a tenant id to restrict to one org.
    tenant: process.env.MS_TENANT ?? 'common',
    // Must exactly match a redirect URI registered on the Entra app.
    redirectUri: process.env.MS_REDIRECT_URI ?? 'http://localhost:3001/api/outlook/callback',
    // Optional: a true Exchange shared mailbox to read via /users/{addr}. Blank →
    // read the signed-in account via /me.
    mailbox: (process.env.MS_MAILBOX ?? '').trim().toLowerCase(),
    // Space-separated Graph scopes. Read-only ingest — sending stays on SendGrid.
    scopes: process.env.MS_SCOPES
      ?? 'offline_access openid profile email User.Read Mail.Read',
    // How often the background delta sync runs (minutes).
    syncMinutes: Number(process.env.OUTLOOK_SYNC_MINUTES ?? 10),
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

/** True when real Xero OAuth credentials are configured. */
export const hasXero = Boolean(env.XERO.clientId && env.XERO.clientSecret);

/** True when Microsoft Graph OAuth credentials are configured for Outlook sync. */
export const hasOutlook = Boolean(env.MICROSOFT.clientId && env.MICROSOFT.clientSecret);

/** True when a RILO Meet API key is configured (enables the Meet module). */
export const hasMeet = Boolean(env.MEET.apiKey);

/** True when the given email is the configured super admin (case-insensitive). */
export function isSuperAdminEmail(email: string | undefined | null): boolean {
  if (!env.SUPER_ADMIN_EMAIL || !email) return false;
  return email.trim().toLowerCase() === env.SUPER_ADMIN_EMAIL;
}
