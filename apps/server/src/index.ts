import express from 'express';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import helmet from 'helmet';
import cors from 'cors';
import { env, hasEmail, hasAi, hasS3, hasXero } from './env';
import { connectDb } from './db';
import { seedDefaults } from './seed';
import { startInvoiceReminderScheduler } from './lib/invoiceReminders';
import { authRouter } from './routes/auth';
import { emailRouter } from './routes/email';
import { aiRouter } from './routes/ai';
import { uploadsRouter } from './routes/uploads';
import { documentsRouter } from './routes/documents';
import { signRouter } from './routes/sign';
import { crudRouter } from './routes/crud';
import { leadsRouter } from './routes/leads';
import { timelineRouter } from './routes/timeline';
import { xeroRouter } from './routes/xero';
import { xeroWebhookHandler } from './routes/xeroWebhook';
import { usersRouter } from './routes/users';
import { rolesRouter } from './routes/roles';
import { requireAuth } from './middleware/auth';
import { errorHandler } from './middleware/error';
import { RESOURCES, RESOURCE_MODULE } from './models';

const app = express();

if (env.isProd) app.set('trust proxy', 1);

app.use(helmet());
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

// Everything below requires a session.
app.use('/api', requireAuth);

// Server capability flags for the UI (which integrations are configured).
app.get('/api/config', (_req, res) =>
  res.json({ hasEmail, hasAi, hasS3, hasXero }),
);

// User management (GET list is open for assignment dropdowns; writes need
// team:manage) + role management (super-admin only for mutations).
app.use('/api/users', usersRouter);
app.use('/api/roles', rolesRouter);

// Transactional email (templates, agent blasts).
app.use('/api/email', emailRouter);

// AI features (meeting/call summaries).
app.use('/api/ai', aiRouter);

// Direct-to-S3 file uploads (presigned URLs).
app.use('/api/uploads', uploadsRouter);

// Generated documents (invoice / DD report / agreement PDFs + send).
app.use('/api/documents', documentsRouter);

// Xero OAuth connect/callback + invoice push/refresh (org-wide connection).
app.use('/api/xero', xeroRouter);

// Lead-specific actions (e.g. atomic "mark won" conversion). Mounted before the
// generic CRUD router so /leads/:id/win resolves to this handler.
app.use('/api/leads', leadsRouter);

// Read-only Buyer Journey timeline / audit events.
app.use('/api/timeline', timelineRouter);

// Generic CRUD for every domain resource — each gated on its RBAC module.
for (const [resource, model] of Object.entries(RESOURCES)) {
  app.use(`/api/${resource}`, crudRouter(resource, model, RESOURCE_MODULE[resource] ?? resource));
}

app.use(errorHandler);

async function start() {
  await connectDb();
  await seedDefaults();
  startInvoiceReminderScheduler();
  app.listen(env.PORT, () => {
    console.log(`[server] listening on http://localhost:${env.PORT}`);
    console.log(`[server] CORS origin: ${env.CLIENT_ORIGIN}`);
  });
}

start().catch((err) => {
  console.error('[server] failed to start:', err);
  process.exit(1);
});
