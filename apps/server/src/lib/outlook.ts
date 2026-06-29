import { env, hasOutlook } from '../env';
import { OutlookConnection, type AnyModel } from '../models';

/**
 * Minimal Microsoft Graph OAuth 2.0 + Mail client (no SDK — plain fetch),
 * modelled on lib/xero.ts. One org-wide connection is stored as a singleton
 * `OutlookConnection` document; tokens never leave the server. Read-only ingest
 * of Inbox + Sent mail — sending stays on SendGrid.
 */

const AUTH_BASE = `https://login.microsoftonline.com/${env.MICROSOFT.tenant}/oauth2/v2.0`;
const AUTHORIZE_URL = `${AUTH_BASE}/authorize`;
const TOKEN_URL = `${AUTH_BASE}/token`;
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const SCOPES = env.MICROSOFT.scopes;

export { hasOutlook };

type OutlookConn = InstanceType<AnyModel> & {
  accountEmail: string; accessToken: string; refreshToken: string;
  expiresAt?: Date; scopes: string; connectedByEmail: string; connectedAt: string;
  inboxDeltaLink: string; sentDeltaLink: string;
};

export type MailFolder = 'inbox' | 'sent';

/** A non-2xx Graph response, carrying the HTTP status so callers can branch on
 *  it (e.g. a 410 Gone delta token → fall back to a full re-sync) without
 *  pattern-matching the error message. */
export class GraphError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = 'GraphError';
  }
}

/** Graph well-known folder name for each folder we sync. */
const FOLDER_ID: Record<MailFolder, string> = { inbox: 'inbox', sent: 'sentitems' };

/** The single connection document, or null when Outlook isn't linked yet. */
export async function getConnection(): Promise<OutlookConn | null> {
  return (await OutlookConnection.findOne().sort({ createdAt: 1 })) as OutlookConn | null;
}

export async function isConnected(): Promise<boolean> {
  return Boolean(await getConnection());
}

/** The mailbox path prefix — a shared mailbox by address, else the signed-in account. */
function mailboxPrefix(): string {
  return env.MICROSOFT.mailbox ? `/users/${encodeURIComponent(env.MICROSOFT.mailbox)}` : '/me';
}

/** Build the consent URL the browser is redirected to. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT.clientId,
    response_type: 'code',
    redirect_uri: env.MICROSOFT.redirectUri,
    response_mode: 'query',
    scope: SCOPES,
    state,
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

function tokenForm(extra: Record<string, string>): URLSearchParams {
  return new URLSearchParams({
    client_id: env.MICROSOFT.clientId,
    client_secret: env.MICROSOFT.clientSecret,
    redirect_uri: env.MICROSOFT.redirectUri,
    scope: SCOPES,
    ...extra,
  });
}

/** Exchange an authorization code for tokens, resolve the mailbox, and persist. */
export async function exchangeCode(code: string, connectedByEmail: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenForm({ grant_type: 'authorization_code', code }),
  });
  if (!res.ok) throw new Error(`Microsoft token exchange failed (${res.status}): ${await res.text()}`);
  const token = (await res.json()) as TokenResponse;

  // Resolve which mailbox this token reads.
  const meRes = await fetch(`${GRAPH_BASE}/me`, {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
  });
  const me = meRes.ok ? ((await meRes.json()) as { mail?: string; userPrincipalName?: string }) : {};
  const accountEmail = (env.MICROSOFT.mailbox || me.mail || me.userPrincipalName || '').toLowerCase();

  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  // Singleton: replace any existing connection (fresh delta cursors).
  await OutlookConnection.deleteMany({});
  await OutlookConnection.create({
    accountEmail,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt,
    scopes: token.scope ?? SCOPES,
    connectedByEmail,
    connectedAt: new Date().toISOString(),
  });
}

/** Return a valid access token, refreshing (and persisting rotated tokens) if expired. */
async function validAccessToken(conn: OutlookConn): Promise<string> {
  const stillValid = conn.expiresAt && conn.expiresAt.getTime() - 60_000 > Date.now();
  if (stillValid) return conn.accessToken;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenForm({ grant_type: 'refresh_token', refresh_token: conn.refreshToken }),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed (${res.status}). Reconnect Outlook in Settings.`);
  const token = (await res.json()) as TokenResponse;

  conn.accessToken = token.access_token;
  if (token.refresh_token) conn.refreshToken = token.refresh_token; // Microsoft rotates refresh tokens.
  conn.expiresAt = new Date(Date.now() + token.expires_in * 1000);
  await conn.save();
  return conn.accessToken;
}

/**
 * Authenticated Graph call with one auto-refresh retry on 401. `url` may be a
 * full URL (e.g. a saved deltaLink/nextLink) or a path appended to GRAPH_BASE.
 */
async function graphFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const conn = await getConnection();
  if (!conn) throw new Error('Outlook is not connected.');
  let token = await validAccessToken(conn);
  const full = url.startsWith('http') ? url : `${GRAPH_BASE}${url}`;

  const doFetch = (bearer: string) =>
    fetch(full, {
      ...init,
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });

  let res = await doFetch(token);
  if (res.status === 401) {
    conn.expiresAt = new Date(0); // force refresh
    token = await validAccessToken(conn);
    res = await doFetch(token);
  }
  return res;
}

export async function disconnect(): Promise<void> {
  await OutlookConnection.deleteMany({});
}

/* ───────────────────────── message shapes ───────────────────────────── */

interface GraphRecipient {
  emailAddress?: { name?: string; address?: string };
}

interface GraphMessage {
  id: string;
  '@removed'?: unknown; // present on delta tombstones for deleted messages
  internetMessageId?: string;
  conversationId?: string;
  subject?: string;
  bodyPreview?: string;
  body?: { contentType?: string; content?: string };
  from?: GraphRecipient;
  toRecipients?: GraphRecipient[];
  ccRecipients?: GraphRecipient[];
  sentDateTime?: string;
  receivedDateTime?: string;
  hasAttachments?: boolean;
}

interface DeltaResponse {
  value?: GraphMessage[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

const SELECT =
  '$select=subject,bodyPreview,body,from,toRecipients,ccRecipients,sentDateTime,receivedDateTime,conversationId,internetMessageId,hasAttachments';

/** Mapped, CRM-shaped email plus the raw Graph id (so the caller can detect tombstones). */
export interface MappedMessage {
  graphId: string;
  removed: boolean;
  fields: Record<string, unknown>;
}

function recipientList(list?: GraphRecipient[]): Array<{ name: string; address: string }> {
  return (list ?? []).map((r) => ({
    name: r.emailAddress?.name ?? '',
    address: (r.emailAddress?.address ?? '').toLowerCase(),
  }));
}

/** Convert a Graph message into EmailMessage fields. */
function mapMessage(raw: GraphMessage, folder: MailFolder): MappedMessage {
  const fromAddress = (raw.from?.emailAddress?.address ?? '').toLowerCase();
  const direction = folder === 'sent' ? 'outbound' : 'inbound';
  return {
    graphId: raw.id,
    removed: '@removed' in raw,
    fields: {
      graphId: raw.id,
      internetMessageId: raw.internetMessageId ?? '',
      conversationId: raw.conversationId ?? '',
      subject: raw.subject ?? '',
      bodyPreview: raw.bodyPreview ?? '',
      bodyHtml: raw.body?.content ?? '',
      fromName: raw.from?.emailAddress?.name ?? '',
      fromAddress,
      toRecipients: recipientList(raw.toRecipients),
      ccRecipients: recipientList(raw.ccRecipients),
      sentAt: raw.sentDateTime ?? '',
      receivedAt: raw.receivedDateTime ?? '',
      direction,
      folder,
      hasAttachments: Boolean(raw.hasAttachments),
    },
  };
}

/**
 * Run a Graph delta query for one folder, paging through every `@odata.nextLink`.
 * Pass the previously saved deltaLink to fetch only changes since last sync;
 * pass '' for a first full sync. Returns the mapped messages plus the new
 * deltaLink to persist for next time.
 */
export async function fetchDelta(
  folder: MailFolder,
  savedDeltaLink: string,
): Promise<{ messages: MappedMessage[]; deltaLink: string }> {
  let url = savedDeltaLink
    || `${mailboxPrefix()}/mailFolders/${FOLDER_ID[folder]}/messages/delta?${SELECT}`;
  const messages: MappedMessage[] = [];
  let deltaLink = savedDeltaLink;

  // Cap pages defensively so a runaway loop can't hang the scheduler.
  for (let page = 0; page < 50; page++) {
    const res = await graphFetch(url);
    if (!res.ok) {
      // A 410 Gone means the delta token expired — caller should retry full.
      throw new GraphError(res.status, `Graph delta (${folder}) failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as DeltaResponse;
    for (const m of data.value ?? []) messages.push(mapMessage(m, folder));
    if (data['@odata.nextLink']) {
      url = data['@odata.nextLink'];
      continue;
    }
    deltaLink = data['@odata.deltaLink'] ?? deltaLink;
    break;
  }
  return { messages, deltaLink };
}

/** Fetch one attachment's raw bytes (for the on-demand download endpoint). */
export async function fetchAttachment(graphMessageId: string, attachmentId: string): Promise<Response> {
  return graphFetch(
    `${mailboxPrefix()}/messages/${graphMessageId}/attachments/${attachmentId}/$value`,
  );
}

/** List a message's attachment metadata (id/name/size/type) for sync enrichment. */
export interface GraphAttachmentMeta {
  id: string;
  name?: string;
  size?: number;
  contentType?: string;
  isInline?: boolean;
}
export async function listAttachments(graphMessageId: string): Promise<GraphAttachmentMeta[]> {
  const res = await graphFetch(
    `${mailboxPrefix()}/messages/${graphMessageId}/attachments?$select=id,name,size,contentType,isInline`,
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { value?: GraphAttachmentMeta[] };
  return data.value ?? [];
}
