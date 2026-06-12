import crypto from 'node:crypto';
import { env, hasXero } from '../env';
import { XeroConnection, type AnyModel } from '../models';

/**
 * Minimal Xero OAuth 2.0 + Accounting API client (no SDK — plain fetch).
 * One org-wide connection is stored as a singleton `XeroConnection` document;
 * tokens never leave the server.
 */

const AUTHORIZE_URL = 'https://login.xero.com/identity/connect/authorize';
const TOKEN_URL = 'https://identity.xero.com/connect/token';
const CONNECTIONS_URL = 'https://api.xero.com/connections';
const API_BASE = 'https://api.xero.com/api.xro/2.0';
// Scopes are env-configurable so they can match the Xero app's granular scopes.
const SCOPES = env.XERO.scopes;

export { hasXero };

type XeroConn = InstanceType<AnyModel> & {
  tenantId: string; tenantName: string; accessToken: string; refreshToken: string;
  expiresAt?: Date; scopes: string; connectedByEmail: string; connectedAt: string;
};

/** The single connection document, or null when Xero isn't linked yet. */
export async function getConnection(): Promise<XeroConn | null> {
  return (await XeroConnection.findOne().sort({ createdAt: 1 })) as XeroConn | null;
}

export async function isConnected(): Promise<boolean> {
  return Boolean(await getConnection());
}

/** Build the consent URL the browser is redirected to. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.XERO.clientId,
    redirect_uri: env.XERO.redirectUri,
    state,
  });
  // `scope` must be space-delimited and encoded as %20. URLSearchParams encodes
  // spaces as "+", which Xero treats literally → rejects as invalid_scope.
  return `${AUTHORIZE_URL}?${params.toString()}&scope=${encodeURIComponent(SCOPES)}`;
}

function basicAuthHeader(): string {
  return 'Basic ' + Buffer.from(`${env.XERO.clientId}:${env.XERO.clientSecret}`).toString('base64');
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
}

/** Exchange an authorization code for tokens, resolve the tenant, and persist. */
export async function exchangeCode(code: string, connectedByEmail: string): Promise<void> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.XERO.redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Xero token exchange failed (${res.status}): ${await res.text()}`);
  const token = (await res.json()) as TokenResponse;

  // Resolve which organisation (tenant) this token can access.
  const connRes = await fetch(CONNECTIONS_URL, {
    headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/json' },
  });
  if (!connRes.ok) throw new Error(`Xero connections lookup failed (${connRes.status})`);
  const connections = (await connRes.json()) as Array<{ tenantId: string; tenantName: string }>;
  if (!connections.length) throw new Error('No Xero organisation was authorised.');
  const tenant = connections[0];

  const expiresAt = new Date(Date.now() + token.expires_in * 1000);
  // Singleton: replace any existing connection.
  await XeroConnection.deleteMany({});
  await XeroConnection.create({
    tenantId: tenant.tenantId,
    tenantName: tenant.tenantName,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt,
    scopes: token.scope ?? SCOPES,
    connectedByEmail,
    connectedAt: new Date().toISOString(),
  });
}

/** Return a valid access token, refreshing (and persisting rotated tokens) if expired. */
async function validAccessToken(conn: XeroConn): Promise<string> {
  const stillValid = conn.expiresAt && conn.expiresAt.getTime() - 60_000 > Date.now();
  if (stillValid) return conn.accessToken;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: conn.refreshToken }),
  });
  if (!res.ok) throw new Error(`Xero token refresh failed (${res.status}). Reconnect Xero in Settings.`);
  const token = (await res.json()) as TokenResponse;

  conn.accessToken = token.access_token;
  conn.refreshToken = token.refresh_token; // Xero rotates the refresh token — persist the new one.
  conn.expiresAt = new Date(Date.now() + token.expires_in * 1000);
  await conn.save();
  return conn.accessToken;
}

/** Authenticated Xero API call with one auto-refresh retry on 401. */
async function xeroFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const conn = await getConnection();
  if (!conn) throw new Error('Xero is not connected.');
  let token = await validAccessToken(conn);

  const doFetch = (bearer: string) =>
    fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Xero-tenant-id': conn.tenantId,
        Accept: 'application/json',
        'Content-Type': 'application/json',
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

export interface ContactInput {
  firstName?: string;
  lastName?: string;
  /** Org/display name; falls back to first+last, then email. */
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  /** When set, the existing Xero contact is updated instead of created/looked up. */
  xeroContactId?: string;
}

/** Build the Xero Contacts API body from our contact fields. */
function contactBody(c: ContactInput, contactId?: string): Record<string, unknown> {
  const display = c.company?.trim() || `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim() || c.name?.trim() || c.email || 'Client';
  const body: Record<string, unknown> = { Name: display };
  if (contactId) body.ContactID = contactId;
  if (c.firstName) body.FirstName = c.firstName;
  if (c.lastName) body.LastName = c.lastName;
  if (c.email) body.EmailAddress = c.email;
  if (c.phone) body.Phones = [{ PhoneType: 'DEFAULT', PhoneNumber: c.phone }];
  return body;
}

/**
 * Create, update, or find-then-reuse a Xero contact. Returns its ContactID.
 * - `xeroContactId` set → POST update that contact.
 * - else email matches an existing contact → reuse its ContactID.
 * - else → create a new contact.
 */
export async function upsertContact(c: ContactInput): Promise<string> {
  if (c.xeroContactId) {
    const res = await xeroFetch('/Contacts', {
      method: 'POST',
      body: JSON.stringify({ Contacts: [contactBody(c, c.xeroContactId)] }),
    });
    if (!res.ok) throw new Error(`Xero contact update failed (${res.status}): ${await res.text()}`);
    return c.xeroContactId;
  }
  if (c.email) {
    const where = encodeURIComponent(`EmailAddress="${c.email.replace(/"/g, '')}"`);
    const res = await xeroFetch(`/Contacts?where=${where}`);
    if (res.ok) {
      const data = (await res.json()) as { Contacts?: Array<{ ContactID: string }> };
      if (data.Contacts?.length) return data.Contacts[0].ContactID;
    }
  }
  const createRes = await xeroFetch('/Contacts', {
    method: 'POST',
    body: JSON.stringify({ Contacts: [contactBody(c)] }),
  });
  if (!createRes.ok) throw new Error(`Xero contact create failed (${createRes.status}): ${await createRes.text()}`);
  const created = (await createRes.json()) as { Contacts: Array<{ ContactID: string }> };
  return created.Contacts[0].ContactID;
}

export interface PushedInvoice {
  xeroInvoiceId: string;
  xeroStatus: string;
  xeroUrl: string;
  invoiceNumber: string;
}

interface InvoiceInput {
  invoiceNumber: string;
  amount: number;
  dueDate: string;
  description: string;
}

/** Build the Xero ACCREC invoice line items (GST-exclusive — Xero computes the 15%). */
function invoiceLineItems(invoice: InvoiceInput) {
  return [
    {
      Description: invoice.description || 'Buyer agency services',
      Quantity: 1,
      UnitAmount: invoice.amount,
      AccountCode: env.XERO.salesAccountCode,
      TaxType: env.XERO.taxType,
    },
  ];
}

/** Deep link to an invoice in Xero (drafts open in the edit view). */
function invoiceDeepLink(id: string, status: string): string {
  const view = status === 'DRAFT' ? 'edit' : 'view';
  return `https://go.xero.com/app/invoicing/${view}/${id}`;
}

/**
 * Push a CRM invoice into Xero as a DRAFT ACCREC invoice. Drafts stay editable,
 * so later CRM edits sync via `updateInvoice`; staff approve/send in Xero.
 */
export async function pushInvoice(invoice: InvoiceInput, contact: ContactInput): Promise<PushedInvoice> {
  const contactId = await upsertContact(contact);
  const today = new Date().toISOString().slice(0, 10);
  const payload = {
    Invoices: [
      {
        Type: 'ACCREC',
        Contact: { ContactID: contactId },
        Date: today,
        DueDate: invoice.dueDate || today,
        Reference: invoice.invoiceNumber,
        Status: 'DRAFT',
        LineAmountTypes: 'Exclusive',
        LineItems: invoiceLineItems(invoice),
      },
    ],
  };
  const res = await xeroFetch('/Invoices', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Xero invoice push failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { Invoices: Array<{ InvoiceID: string; InvoiceNumber: string; Status: string }> };
  const created = data.Invoices[0];
  return {
    xeroInvoiceId: created.InvoiceID,
    xeroStatus: created.Status,
    invoiceNumber: created.InvoiceNumber || invoice.invoiceNumber,
    xeroUrl: invoiceDeepLink(created.InvoiceID, created.Status),
  };
}

/**
 * Update an existing Xero invoice (only effective while it is a DRAFT — Xero
 * rejects edits to authorised/paid invoices). Returns the current status, or
 * null if Xero refused the edit (e.g. already approved).
 */
export async function updateInvoice(xeroInvoiceId: string, invoice: InvoiceInput): Promise<string | null> {
  const payload = {
    Invoices: [
      {
        InvoiceID: xeroInvoiceId,
        DueDate: invoice.dueDate || undefined,
        Reference: invoice.invoiceNumber,
        LineAmountTypes: 'Exclusive',
        LineItems: invoiceLineItems(invoice),
      },
    ],
  };
  const res = await xeroFetch('/Invoices', { method: 'POST', body: JSON.stringify(payload) });
  if (!res.ok) return null;
  const data = (await res.json()) as { Invoices?: Array<{ Status: string }> };
  return data.Invoices?.[0]?.Status ?? null;
}

export interface XeroInvoiceState {
  status: string;
  fullyPaidOnDate: string;
}

/** Read the current status of a Xero invoice (for webhook/manual status sync). */
export async function getInvoice(xeroInvoiceId: string): Promise<XeroInvoiceState | null> {
  const res = await xeroFetch(`/Invoices/${xeroInvoiceId}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { Invoices?: Array<{ Status: string; FullyPaidOnDate?: string }> };
  const inv = data.Invoices?.[0];
  if (!inv) return null;
  return { status: inv.Status, fullyPaidOnDate: inv.FullyPaidOnDate ?? '' };
}

/** Map a Xero invoice status to our InvoiceStatus enum (only when it maps cleanly). */
export function mapStatus(xeroStatus: string): 'paid' | 'sent' | 'draft' | null {
  if (xeroStatus === 'PAID') return 'paid';
  if (xeroStatus === 'AUTHORISED' || xeroStatus === 'SUBMITTED') return 'sent';
  if (xeroStatus === 'DRAFT') return 'draft';
  return null;
}

export interface XeroContact {
  ContactID: string;
  Name?: string;
  FirstName?: string;
  LastName?: string;
  EmailAddress?: string;
  CompanyNumber?: string;
  Phones?: Array<{ PhoneType?: string; PhoneNumber?: string }>;
}

/** Fetch all Xero contacts (paginated, 100/page) for the initial import. */
export async function listContacts(): Promise<XeroContact[]> {
  const all: XeroContact[] = [];
  for (let page = 1; ; page++) {
    const res = await xeroFetch(`/Contacts?page=${page}`);
    if (!res.ok) break;
    const data = (await res.json()) as { Contacts?: XeroContact[] };
    const batch = data.Contacts ?? [];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

export interface XeroInvoiceSummary {
  InvoiceID: string;
  InvoiceNumber?: string;
  Reference?: string;
  Status: string;
  FullyPaidOnDate?: string;
}

/** Fetch all ACCREC (sales) invoices (paginated, 100/page) for linking on import. */
export async function listInvoices(): Promise<XeroInvoiceSummary[]> {
  const all: XeroInvoiceSummary[] = [];
  const where = encodeURIComponent('Type=="ACCREC"');
  for (let page = 1; ; page++) {
    const res = await xeroFetch(`/Invoices?where=${where}&page=${page}`);
    if (!res.ok) break;
    const data = (await res.json()) as { Invoices?: XeroInvoiceSummary[] };
    const batch = data.Invoices ?? [];
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return all;
}

/** Read a single Xero contact by ID (for webhook-driven contact sync). */
export async function getContact(xeroContactId: string): Promise<XeroContact | null> {
  const res = await xeroFetch(`/Contacts/${xeroContactId}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { Contacts?: XeroContact[] };
  return data.Contacts?.[0] ?? null;
}

/** Verify a Xero webhook payload signature (base64 HMAC-SHA256 of the raw body). */
export function verifyWebhookSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!env.XERO.webhookKey || !signature) return false;
  const computed = crypto.createHmac('sha256', env.XERO.webhookKey).update(rawBody).digest('base64');
  const a = Buffer.from(computed);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function disconnect(): Promise<void> {
  await XeroConnection.deleteMany({});
}
