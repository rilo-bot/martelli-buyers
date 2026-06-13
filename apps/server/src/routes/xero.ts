import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Invoice, Deal, Client, User } from '../models';
import { asyncHandler } from '../middleware/error';
import { env, hasXero } from '../env';
import {
  getConnection, buildAuthorizeUrl, exchangeCode, disconnect,
  pushInvoice, getInvoice, mapStatus,
} from '../lib/xero';
import { runInitialImport } from '../lib/xeroImport';
import { syncClientToXero } from '../lib/xeroSync';
import { requirePermission } from '../lib/permissions';

export const xeroRouter = Router();

const WEB = env.CLIENT_ORIGIN.replace(/\/+$/, '');

/** GET /api/xero/status — connection state for the UI (never returns tokens). */
xeroRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const conn = await getConnection();
    res.json({
      configured: hasXero,
      connected: Boolean(conn),
      tenantName: conn?.tenantName ?? '',
      connectedByEmail: conn?.connectedByEmail ?? '',
      expiresAt: conn?.expiresAt ?? null,
      importStatus: conn?.get('importStatus') ?? 'idle',
      lastImportAt: conn?.get('lastImportAt') ?? '',
      importedClients: conn?.get('importedClients') ?? 0,
      linkedInvoices: conn?.get('linkedInvoices') ?? 0,
    });
  }),
);

// Everything past /status mutates the Xero integration — admin concern.
xeroRouter.use(requirePermission('settings:manage'));

/** GET /api/xero/connect — kick off OAuth (browser navigates here). */
xeroRouter.get(
  '/connect',
  asyncHandler(async (req, res) => {
    if (!hasXero) {
      res.status(503).json({ error: 'Xero is not configured on the server.' });
      return;
    }
    const state = randomUUID().replace(/-/g, '');
    req.session.xeroState = state;
    res.redirect(buildAuthorizeUrl(state));
  }),
);

/** GET /api/xero/callback — Xero redirects back here with code + state. */
xeroRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state } = req.query as { code?: string; state?: string; error?: string };
    const expected = req.session.xeroState;
    req.session.xeroState = undefined;

    if (!code || !state || state !== expected) {
      res.redirect(`${WEB}/settings?xero=error`);
      return;
    }
    try {
      const user = req.session.userId ? await User.findById(req.session.userId) : null;
      const email = user?.get('email') ?? '';
      await exchangeCode(code, email);
      // Pull contacts/invoices in the background — don't block the redirect on a
      // potentially large import. The Settings card polls status to show progress.
      void runInitialImport(email).catch((err) =>
        console.error('[xero] initial import failed:', (err as Error).message),
      );
      res.redirect(`${WEB}/settings?xero=connected`);
    } catch {
      res.redirect(`${WEB}/settings?xero=error`);
    }
  }),
);

/** POST /api/xero/disconnect — drop the stored connection. */
xeroRouter.post(
  '/disconnect',
  asyncHandler(async (_req, res) => {
    await disconnect();
    res.json({ ok: true });
  }),
);

/** POST /api/xero/invoice/:id/push — create the invoice in Xero. */
xeroRouter.post(
  '/invoice/:id/push',
  asyncHandler(async (req, res) => {
    if (!hasXero) {
      res.status(503).json({ error: 'Xero is not configured on the server.' });
      return;
    }
    if (!(await getConnection())) {
      res.status(409).json({ error: 'Xero is not connected. Connect it in Settings.' });
      return;
    }
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) {
      res.status(404).json({ error: 'Invoice not found.' });
      return;
    }
    if (invoice.get('xeroInvoiceId')) {
      res.status(409).json({ error: 'This invoice is already in Xero.' });
      return;
    }
    const deal = invoice.get('dealId') ? await Deal.findById(invoice.get('dealId')) : null;
    const client = deal?.get('clientId') ? await Client.findById(deal.get('clientId')) : null;
    const pushed = await pushInvoice(
      {
        invoiceNumber: invoice.get('invoiceNumber'),
        amount: invoice.get('amount'),
        dueDate: invoice.get('dueDate'),
        description: invoice.get('description'),
      },
      {
        firstName: client?.get('firstName'),
        lastName: client?.get('lastName'),
        name: deal?.get('clientName') ?? '',
        email: client?.get('email') || deal?.get('clientEmail') || '',
        phone: client?.get('phone'),
        company: client?.get('company'),
        xeroContactId: client?.get('xeroContactId') || undefined,
      },
    );

    invoice.set('xeroInvoiceId', pushed.xeroInvoiceId);
    invoice.set('xeroStatus', pushed.xeroStatus);
    invoice.set('xeroUrl', pushed.xeroUrl);
    invoice.set('xeroLastSyncedAt', new Date().toISOString());
    if (pushed.invoiceNumber) invoice.set('invoiceNumber', pushed.invoiceNumber);
    const mapped = mapStatus(pushed.xeroStatus);
    if (mapped) invoice.set('status', mapped);
    await invoice.save();
    res.json(invoice.toJSON());
  }),
);

const refreshParams = z.object({ id: z.string() });

/** POST /api/xero/invoice/:id/refresh — pull current status from Xero (manual fallback). */
xeroRouter.post(
  '/invoice/:id/refresh',
  asyncHandler(async (req, res) => {
    refreshParams.parse(req.params);
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice || !invoice.get('xeroInvoiceId')) {
      res.status(404).json({ error: 'Invoice is not linked to Xero.' });
      return;
    }
    const state = await getInvoice(invoice.get('xeroInvoiceId'));
    if (!state) {
      res.status(502).json({ error: 'Could not read the invoice from Xero.' });
      return;
    }
    invoice.set('xeroStatus', state.status);
    invoice.set('xeroLastSyncedAt', new Date().toISOString());
    const mapped = mapStatus(state.status);
    if (mapped) invoice.set('status', mapped);
    if (state.status === 'PAID' && state.fullyPaidOnDate) {
      invoice.set('paidDate', state.fullyPaidOnDate.slice(0, 10));
    }
    await invoice.save();
    res.json(invoice.toJSON());
  }),
);

/** POST /api/xero/import — re-run the contact/invoice pull from Xero (idempotent). */
xeroRouter.post(
  '/import',
  asyncHandler(async (_req, res) => {
    const conn = await getConnection();
    if (!conn) {
      res.status(409).json({ error: 'Xero is not connected. Connect it in Settings.' });
      return;
    }
    if (conn.get('importStatus') === 'running') {
      res.status(409).json({ error: 'An import is already in progress.' });
      return;
    }
    // Run in the background; the UI polls /status for progress.
    void runInitialImport(conn.get('connectedByEmail') ?? '').catch((err) =>
      console.error('[xero] manual import failed:', (err as Error).message),
    );
    res.json({ ok: true, importStatus: 'running' });
  }),
);

/** POST /api/xero/contact/:id/push — manual retry of one client's Xero sync. */
xeroRouter.post(
  '/contact/:id/push',
  asyncHandler(async (req, res) => {
    if (!hasXero) {
      res.status(503).json({ error: 'Xero is not configured on the server.' });
      return;
    }
    if (!(await getConnection())) {
      res.status(409).json({ error: 'Xero is not connected. Connect it in Settings.' });
      return;
    }
    const client = await Client.findById(req.params.id);
    if (!client) {
      res.status(404).json({ error: 'Client not found.' });
      return;
    }
    await syncClientToXero(client);
    const fresh = await Client.findById(req.params.id);
    res.json((fresh ?? client).toJSON());
  }),
);
