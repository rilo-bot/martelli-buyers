import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import { env, hasEmail, hasAi, hasS3, hasXero, hasOutlook, hasMeet } from './env';
import { connectDb } from './db';
import { seedDefaults } from './seed';
import { startInvoiceReminderScheduler } from './lib/invoiceReminders';
import { startOutlookSyncScheduler } from './lib/outlookSync';
import { authRouter } from './routes/auth';
import { emailRouter } from './routes/email';
import { aiRouter } from './routes/ai';
import { uploadsRouter } from './routes/uploads';
import { documentsRouter } from './routes/documents';
import { signRouter } from './routes/sign';
import { contactFormPublicRouter } from './routes/contactFormPublic';
import { filesRouter } from './routes/files';
import { crudRouter } from './routes/crud';
import { leadsRouter } from './routes/leads';
import { enquiriesRouter } from './routes/enquiries';
import { timelineRouter } from './routes/timeline';
import { journeysRouter } from './routes/journeys';
import { xeroRouter } from './routes/xero';
import { xeroWebhookHandler } from './routes/xeroWebhook';
import { outlookRouter } from './routes/outlook';
import { usersRouter } from './routes/users';
import { rolesRouter } from './routes/roles';
import { companySettingsRouter } from './routes/companySettings';
import { meetRouter } from './routes/meet';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { RESOURCES, RESOURCE_MODULE } from './models';
import { closeBrowser } from './lib/pdf/htmlToPdf';

const app = express();

if (env.isProd) app.set('trust proxy', 1);

app.use(helmet());

// Public contact-form surface (config read, submit, embed.js). Mounted BEFORE
// the cookie-scoped CORS below because embeds are cross-origin and need their
// own permissive, origin-reflecting CORS. It only matches /api/public/form* and
// /api/public/embed.js; everything else falls through to the routes below.
app.use('/api/public', contactFormPublicRouter);

app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);
// Xero webhook needs the RAW body for HMAC verification — register it with a
// raw parser BEFORE express.json() (and before the auth gate; it's public).
app.post('/api/xero/webhook', express.raw({ type: '*/*' }), xeroWebhookHandler);

app.use(express.json({ limit: '2mb' }));

app.use(
  session({
    name: 'rilo.sid',
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: env.MONGODB_URI, ttl: 14 * 24 * 60 * 60 }),
    cookie: {
      httpOnly: true,
      sameSite: env.isProd ? 'none' : 'lax',
      secure: env.isProd,
      maxAge: 14 * 24 * 60 * 60 * 1000,
    },
  }),
);

// Health check (unauthenticated)
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// Auth (unauthenticated entry points)
app.use('/api/auth', authRouter);

// Public agreement e-signing (token-scoped, no session — clients sign here).
app.use('/api/sign', signRouter);

// (The public contact-form surface at /api/public/form* is mounted above, before
// the cookie-CORS, so embeds can use origin-reflecting CORS.)

// Public image proxy for embedded assets (logos, photos, avatars). No session —
// the app, generated PDFs and outbound emails all load images from here. Serves
// images only; private documents stay behind the authenticated routes below.
app.use('/api/files', filesRouter);

// Everything below requires a session.
app.use('/api', requireAuth);

// Server capability flags for the UI (which integrations are configured).
app.get('/api/config', (_req, res) =>
  res.json({ hasEmail, hasAi, hasS3, hasXero, hasOutlook, hasMeet }),
);

// User management (GET list is open for assignment dropdowns; writes need
// team:manage) + role management (mutations need team:manage; the built-in
// Admin role stays super-admin-only).
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);

// Org-wide company settings (identity, branding, invoice template).
app.use('/api/company-settings', companySettingsRouter);

// Transactional email (templates, agent blasts).
app.use('/api/email', emailRouter);

// AI features (meeting/call summaries).
app.use('/api/ai', aiRouter);

// Direct-to-S3 file uploads (presigned URLs).
app.use('/api/uploads', uploadsRouter);

// Generated documents (invoice / DD report / agreement PDFs + send). These are
// deep action paths (/invoice/:id.pdf, /agreement/:id/send, …). The generic
// CRUD loop below also mounts the `documents` catalogue resource at
// /api/documents — its root + /:id routes fall through past this router, so the
// two coexist under one namespace without colliding.
app.use('/api/documents', documentsRouter);

// Xero OAuth connect/callback + invoice push/refresh (org-wide connection).
app.use('/api/xero', xeroRouter);

// Outlook (Microsoft Graph) OAuth connect/callback + email sync (org-wide mailbox).
app.use('/api/outlook', outlookRouter);

// RILO Meet (external video meetings). Server-side proxy — the API key never
// reaches the browser; routes are gated on the `meet` RBAC module.
app.use('/api/meet', meetRouter);

// Lead-specific actions (e.g. atomic "mark won" conversion). Mounted before the
// generic CRUD router so /leads/:id/win resolves to this handler.
app.use('/api/leads', leadsRouter);

// Contact-enquiry actions (convert an enquiry into a Lead). Mounted before the
// generic CRUD router so /enquiries/:id/convert resolves to this handler.
app.use('/api/enquiries', enquiriesRouter);

// Read-only Buyer Journey timeline / audit events.
app.use('/api/timeline', timelineRouter);

// Read-only Buyer Journey aggregates (e.g. comparable sales) scoped to
// journeys:view, so journey viewers see them without needing dueDiligence:view.
app.use('/api/journeys', journeysRouter);

// Generic CRUD for every domain resource — each gated on its RBAC module.
for (const [resource, model] of Object.entries(RESOURCES)) {
  app.use(`/api/${resource}`, crudRouter(resource, model, RESOURCE_MODULE[resource] ?? resource));
}

app.use(errorHandler);

async function start() {
  await connectDb();
  await seedDefaults();
  startInvoiceReminderScheduler();
  startOutlookSyncScheduler();
  app.listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT}`);
    console.log(`[server] CORS origin: ${env.CLIENT_ORIGIN}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});

// Close the shared headless-Chromium browser (used for agreement PDFs) on exit
// so a redeploy/restart doesn't leak an orphaned process.
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.once(sig, () => {
    void closeBrowser().finally(() => process.exit(0));
  });
}
