import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { EmailMessage, User } from '../models';
import { asyncHandler } from '../middleware/error';
import { env, hasOutlook } from '../env';
import {
  getConnection, buildAuthorizeUrl, exchangeCode, disconnect, fetchAttachment,
} from '../lib/outlook';
import { runSync } from '../lib/outlookSync';
import { requirePermission } from '../lib/permissions';

export const outlookRouter = Router();

const WEB = env.CLIENT_ORIGIN.replace(/\/+$/, '');

/** GET /api/outlook/status — connection state for the UI (never returns tokens). */
outlookRouter.get(
  '/status',
  asyncHandler(async (_req, res) => {
    const conn = await getConnection();
    res.json({
      configured: hasOutlook,
      connected: Boolean(conn),
      accountEmail: conn?.get('accountEmail') ?? '',
      connectedByEmail: conn?.get('connectedByEmail') ?? '',
      syncStatus: conn?.get('syncStatus') ?? 'idle',
      lastSyncAt: conn?.get('lastSyncAt') ?? '',
      syncedCount: conn?.get('syncedCount') ?? 0,
      syncError: conn?.get('syncError') ?? '',
    });
  }),
);

// On-demand attachment download — readable by anyone who can view emails.
// Placed before the settings:manage gate below so staff (not just admins) can
// open attachments on emails they're allowed to see.
outlookRouter.get(
  '/messages/:id/attachments/:attachmentId',
  requirePermission('emails:view'),
  asyncHandler(async (req, res) => {
    const msg = await EmailMessage.findById(req.params.id);
    if (!msg) {
      res.status(404).json({ error: 'Email not found.' });
      return;
    }
    const meta = (msg.get('attachments') as Array<{ graphId: string; name: string; contentType: string }>)
      .find((a) => a.graphId === req.params.attachmentId);
    const graphRes = await fetchAttachment(msg.get('graphId'), req.params.attachmentId);
    if (!graphRes.ok) {
      res.status(502).json({ error: 'Could not fetch the attachment from Outlook.' });
      return;
    }
    const buf = Buffer.from(await graphRes.arrayBuffer());
    res.setHeader('Content-Type', meta?.contentType || graphRes.headers.get('content-type') || 'application/octet-stream');
    if (meta?.name) res.setHeader('Content-Disposition', `inline; filename="${meta.name.replace(/"/g, '')}"`);
    res.send(buf);
  }),
);

// Everything past here mutates the org-wide Outlook integration — admin concern.
outlookRouter.use(requirePermission('settings:manage'));

/** GET /api/outlook/connect — kick off OAuth (browser navigates here). */
outlookRouter.get(
  '/connect',
  asyncHandler(async (req, res) => {
    if (!hasOutlook) {
      res.status(503).json({ error: 'Outlook is not configured on the server.' });
      return;
    }
    const state = randomUUID().replace(/-/g, '');
    req.session.outlookState = state;
    res.redirect(buildAuthorizeUrl(state));
  }),
);

/** GET /api/outlook/callback — Microsoft redirects back here with code + state. */
outlookRouter.get(
  '/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error, error_description } = req.query as {
      code?: string; state?: string; error?: string; error_description?: string;
    };
    const expected = req.session.outlookState;
    req.session.outlookState = undefined;

    // Microsoft redirected back with an error (denied consent, bad scope, etc.).
    if (error) {
      console.error(`[outlook] authorize error: ${error} — ${error_description ?? ''}`);
      res.redirect(`${WEB}/settings?outlook=error`);
      return;
    }
    if (!code || !state || state !== expected) {
      console.error(
        `[outlook] callback rejected: code=${Boolean(code)} state=${Boolean(state)} stateMatch=${state === expected}`,
      );
      res.redirect(`${WEB}/settings?outlook=error`);
      return;
    }
    try {
      const user = req.session.userId ? await User.findById(req.session.userId) : null;
      const email = user?.get('email') ?? '';
      await exchangeCode(code, email);
      // Pull mail in the background — don't block the redirect on a large mailbox.
      // The Settings card polls /status for progress.
      void runSync().catch((err) =>
        console.error('[outlook] initial sync failed:', (err as Error).message),
      );
      res.redirect(`${WEB}/settings?outlook=connected`);
    } catch (err) {
      console.error('[outlook] token exchange failed:', (err as Error).message);
      res.redirect(`${WEB}/settings?outlook=error`);
    }
  }),
);

/** POST /api/outlook/disconnect — drop the stored connection. */
outlookRouter.post(
  '/disconnect',
  asyncHandler(async (_req, res) => {
    await disconnect();
    res.json({ ok: true });
  }),
);

/** POST /api/outlook/sync — manually trigger a delta sync (idempotent). */
outlookRouter.post(
  '/sync',
  asyncHandler(async (_req, res) => {
    const conn = await getConnection();
    if (!conn) {
      res.status(409).json({ error: 'Outlook is not connected. Connect it in Settings.' });
      return;
    }
    if (conn.get('syncStatus') === 'running') {
      res.status(409).json({ error: 'A sync is already in progress.' });
      return;
    }
    // Run in the background; the UI polls /status for progress.
    void runSync().catch((err) =>
      console.error('[outlook] manual sync failed:', (err as Error).message),
    );
    res.json({ ok: true, syncStatus: 'running' });
  }),
);
