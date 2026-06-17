import { EmailMessage, Client, Deal, type AnyModel } from '../models';
import { env, hasOutlook } from '../env';
import { recordEvent } from './audit';
import {
  getConnection,
  fetchDelta,
  listAttachments,
  type MailFolder,
  type MappedMessage,
} from './outlook';

/**
 * Outlook → CRM email sync, modelled on lib/xeroImport.ts + lib/invoiceReminders.ts.
 * Pulls Inbox + Sent via Graph delta queries, upserts each message by graphId
 * (idempotent — re-syncs never duplicate and never clobber a manual link), and
 * auto-links newly seen messages to a matching client/deal. Best-effort: a single
 * message failure never aborts the rest.
 */

type Doc = InstanceType<AnyModel>;

/** Collect every address on a message (from + to + cc), lowercased + de-duped. */
function addressesOf(fields: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const from = (fields.fromAddress as string) || '';
  if (from) out.add(from);
  for (const key of ['toRecipients', 'ccRecipients'] as const) {
    for (const r of (fields[key] as Array<{ address?: string }>) ?? []) {
      if (r.address) out.add(r.address.toLowerCase());
    }
  }
  return [...out];
}

/**
 * Auto-link a freshly-synced email to a client/deal by matching any of its
 * addresses to a known client. Sets clientId (+ dealId when the client has
 * exactly one deal) and records a timeline event. No-op when nothing matches —
 * the email stays unlinked for manual tagging.
 */
async function autoLink(msg: Doc): Promise<void> {
  const addresses = addressesOf(msg.toObject());
  if (addresses.length === 0) return;

  const client = await Client.findOne({ email: { $in: addresses } });
  let clientId = client ? String(client._id) : '';
  let dealId = '';

  if (clientId) {
    // Prefer the client's own deals; pick the only one if unambiguous.
    const deals = await Deal.find({ clientId }).select('_id').lean();
    if (deals.length === 1) dealId = String(deals[0]._id);
  } else {
    // No client record, but a deal may carry the address as its snapshot.
    const deal = await Deal.findOne({ clientEmail: { $in: addresses } }).select('_id clientId').lean();
    if (deal) {
      dealId = String(deal._id);
      clientId = (deal as { clientId?: string }).clientId ?? '';
    }
  }

  if (!clientId && !dealId) return;

  msg.set('clientId', clientId);
  msg.set('dealId', dealId);
  msg.set('linkSource', 'auto');
  msg.set('linkedAt', new Date().toISOString());
  await msg.save();

  if (dealId) {
    await recordEvent({
      entityType: 'email',
      entityId: String(msg._id),
      dealId,
      action: 'email_linked',
      toValue: msg.get('subject') || '(no subject)',
      actor: { id: '', name: 'Outlook sync' },
    });
  }
}

/**
 * Upsert one synced message by graphId. On insert, also enrich attachment
 * metadata and auto-link. On update, only refresh mail content fields — never
 * touch the link fields (clientId/dealId/linkSource), so a manual tag survives
 * re-syncs. Returns true when a NEW message was inserted.
 */
async function upsertMessage(m: MappedMessage): Promise<boolean> {
  const existing = await EmailMessage.findOne({ graphId: m.graphId });
  if (existing) {
    // Refresh content only (subject/body/flags); preserve any link.
    const { clientId: _c, dealId: _d, linkSource: _l, ...content } = m.fields as Record<string, unknown>;
    void _c; void _d; void _l;
    existing.set(content);
    await existing.save();
    return false;
  }

  const doc = await EmailMessage.create(m.fields);
  // Enrich attachment metadata (best-effort; the list view shows a paperclip
  // from hasAttachments even if this call fails).
  if (doc.get('hasAttachments')) {
    try {
      const atts = await listAttachments(m.graphId);
      if (atts.length) {
        doc.set(
          'attachments',
          atts.map((a) => ({
            graphId: a.id,
            name: a.name ?? '',
            size: a.size ?? 0,
            contentType: a.contentType ?? '',
            isInline: Boolean(a.isInline),
          })),
        );
        await doc.save();
      }
    } catch {
      /* attachment metadata is best-effort */
    }
  }
  await autoLink(doc);
  return true;
}

const FOLDER_CURSOR: Record<MailFolder, 'inboxDeltaLink' | 'sentDeltaLink'> = {
  inbox: 'inboxDeltaLink',
  sent: 'sentDeltaLink',
};

/** One full sync pass across Inbox + Sent. Returns the count of new messages. */
export async function runSync(): Promise<{ inserted: number }> {
  const conn = await getConnection();
  if (!conn) return { inserted: 0 };
  if (conn.get('syncStatus') === 'running') return { inserted: 0 };

  conn.set('syncStatus', 'running');
  conn.set('syncError', '');
  await conn.save();

  let inserted = 0;
  try {
    for (const folder of ['inbox', 'sent'] as MailFolder[]) {
      const cursorField = FOLDER_CURSOR[folder];
      let saved = conn.get(cursorField) as string;
      let result: { messages: MappedMessage[]; deltaLink: string };
      try {
        result = await fetchDelta(folder, saved);
      } catch (err) {
        // A 410 Gone (expired delta token) → fall back to a full re-sync.
        if (saved && /\(410\)/.test((err as Error).message)) {
          result = await fetchDelta(folder, '');
        } else {
          throw err;
        }
      }
      for (const m of result.messages) {
        try {
          if (m.removed) continue; // ignore delete tombstones — keep CRM history
          if (await upsertMessage(m)) inserted++;
        } catch (e) {
          console.error(`[outlook] message ${m.graphId} failed:`, (e as Error).message);
        }
      }
      conn.set(cursorField, result.deltaLink);
      await conn.save();
    }

    conn.set('syncStatus', 'done');
    conn.set('lastSyncAt', new Date().toISOString());
    conn.set('syncedCount', (conn.get('syncedCount') ?? 0) + inserted);
    await conn.save();
  } catch (err) {
    conn.set('syncStatus', 'error');
    conn.set('syncError', (err as Error).message);
    await conn.save();
    console.error('[outlook] sync failed:', (err as Error).message);
  }

  if (inserted) console.log(`[outlook] synced ${inserted} new email(s)`);
  return { inserted };
}

/** Start the periodic delta sync. No-op without credentials/connection. */
export function startOutlookSyncScheduler(): void {
  if (!hasOutlook) {
    console.log('[outlook] not configured — email sync disabled');
    return;
  }
  const everyMs = Math.max(1, env.MICROSOFT.syncMinutes) * 60 * 1000;
  // First pass ~30s after boot so startup isn't blocked.
  setTimeout(() => { void runSync().catch(() => {}); }, 30_000);
  setInterval(() => { void runSync().catch(() => {}); }, everyMs);
  console.log(`[outlook] sync scheduler started (every ${env.MICROSOFT.syncMinutes}m)`);
}
