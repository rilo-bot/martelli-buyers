import { tool } from 'ai';
import { z } from 'zod';
import { Lead, Deal, Client, Property, Invoice, Agent, Task, Offer } from '../models';
import { viewableModules, type AuthContext } from './permissions';
import { buildSnapshot } from './portalData';

/**
 * Read-only data tools for the assistant agent.
 *
 * Every tool is RBAC-gated against the caller's effective permissions: if the
 * user's role can't VIEW a module, the tool returns a clear "no access" object
 * (which the agent relays politely) instead of data. This enforcement lives in
 * `execute`, not the prompt — so even a jailbroken prompt cannot read past a
 * role. No tool here mutates anything; the agent is structurally read-only.
 *
 * Results are projected to compact fields and hard-capped to bound token cost.
 */

const LIMIT_MAX = 25;
const clampLimit = (n?: number) => Math.min(Math.max(Math.trunc(n ?? 10), 1), LIMIT_MAX);

/** Escape user/model-supplied text before using it in a RegExp. */
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const rx = (q: string) => new RegExp(escapeRegex(q), 'i');

const id = (doc: { _id?: unknown }) => String(doc._id ?? '');
const fullName = (d: { firstName?: string; lastName?: string }) =>
  `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim();

const deny = (label: string) => ({
  error: `You do not have permission to view ${label}. Tell the user their role doesn't grant access to this.`,
});

const LEAD_STATUS = ['new', 'contacted', 'qualified', 'agreement_sent', 'active', 'won', 'lost'] as const;
const DEAL_STAGE = ['qualification', 'search', 'shortlisting', 'due_diligence', 'offer', 'settlement', 'complete'] as const;
const PROPERTY_STATUS = ['suggested', 'interested', 'viewed', 'shortlisted', 'rejected', 'offer_placed', 'purchased'] as const;
const INVOICE_STATUS = ['draft', 'sent', 'paid', 'overdue'] as const;
const AGENT_GEO = ['East', 'West', 'North', 'Central'] as const;

/**
 * Build the agent's read-only tool set for a given user. Pass the result to
 * `streamText({ tools })`.
 */
export function buildReadTools(auth: AuthContext) {
  const can = viewableModules(auth);

  return {
    getDashboardMetrics: tool({
      description:
        'Get a portal-wide overview of aggregate counts and metrics (leads, journeys, tasks, invoices, properties, clients, agents), already scoped to what this user may view. Use this for "how many / overview / what needs attention" questions before reaching for the detailed list tools.',
      inputSchema: z.object({}),
      execute: async () => buildSnapshot(auth),
    }),

    searchLeads: tool({
      description:
        'Search or list leads. Optionally filter by a name/email fragment and/or status. Returns compact rows (id, name, email, status, budget).',
      inputSchema: z.object({
        query: z.string().optional().describe('Name or email fragment to match'),
        status: z.enum(LEAD_STATUS).optional(),
        limit: z.number().optional().describe('Max rows (default 10, capped at 25)'),
      }),
      execute: async ({ query, status, limit }) => {
        if (!can.has('leads')) return deny('Leads');
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (query) filter.$or = [{ firstName: rx(query) }, { lastName: rx(query) }, { email: rx(query) }];
        const rows = await Lead.find(filter, {
          firstName: 1, lastName: 1, email: 1, status: 1, budget: 1, assignedTo: 1, updatedAt: 1,
        }).sort({ updatedAt: -1 }).limit(clampLimit(limit)).lean();
        return {
          count: rows.length,
          leads: rows.map((l) => ({
            id: id(l), name: fullName(l), email: l.email, status: l.status, budget: l.budget,
          })),
        };
      },
    }),

    getLead: tool({
      description: 'Get full details for a single lead by id.',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id: leadId }) => {
        if (!can.has('leads')) return deny('Leads');
        const l = await Lead.findById(leadId).lean();
        if (!l) return { error: 'Lead not found.' };
        return {
          id: id(l), name: fullName(l), email: l.email, phone: l.phone, status: l.status,
          source: l.source, budget: l.budget, propertyType: l.propertyType, bedrooms: l.bedrooms,
          bathrooms: l.bathrooms, preferredSuburbs: l.preferredSuburbs, notes: l.notes,
          clientId: l.clientId, updatedAt: l.updatedAt,
        };
      },
    }),

    searchClients: tool({
      description: 'Search or list clients by name/email/company fragment. Returns compact rows.',
      inputSchema: z.object({
        query: z.string().optional(),
        limit: z.number().optional(),
      }),
      execute: async ({ query, limit }) => {
        if (!can.has('clients')) return deny('Clients');
        const filter: Record<string, unknown> = {};
        if (query) filter.$or = [{ firstName: rx(query) }, { lastName: rx(query) }, { email: rx(query) }, { company: rx(query) }];
        const rows = await Client.find(filter, {
          firstName: 1, lastName: 1, email: 1, phone: 1, company: 1, dealIds: 1,
        }).sort({ updatedAt: -1 }).limit(clampLimit(limit)).lean();
        return {
          count: rows.length,
          clients: rows.map((c) => ({
            id: id(c), name: fullName(c), email: c.email, phone: c.phone, company: c.company,
            journeyCount: (c.dealIds ?? []).length,
          })),
        };
      },
    }),

    listJourneys: tool({
      description:
        'List buyer journeys (deals). Optionally filter by stage. Returns compact rows (id, client, stage, budget).',
      inputSchema: z.object({
        stage: z.enum(DEAL_STAGE).optional(),
        limit: z.number().optional(),
      }),
      execute: async ({ stage, limit }) => {
        if (!can.has('journeys')) return deny('Buyer Journeys');
        const filter: Record<string, unknown> = {};
        if (stage) filter.stage = stage;
        const rows = await Deal.find(filter, {
          clientName: 1, stage: 1, budget: 1, agreementStatus: 1, updatedAt: 1,
        }).sort({ updatedAt: -1 }).limit(clampLimit(limit)).lean();
        return {
          count: rows.length,
          journeys: rows.map((d) => ({
            id: id(d), client: d.clientName, stage: d.stage, budget: d.budget,
            agreementStatus: d.agreementStatus,
          })),
        };
      },
    }),

    getJourney: tool({
      description:
        'Get a buyer journey by id, including its linked properties, offers, tasks and invoices (each only if the user may view that area).',
      inputSchema: z.object({ id: z.string() }),
      execute: async ({ id: dealId }) => {
        if (!can.has('journeys')) return deny('Buyer Journeys');
        const d = await Deal.findById(dealId).lean();
        if (!d) return { error: 'Buyer journey not found.' };

        const result: Record<string, unknown> = {
          id: id(d), client: d.clientName, email: d.clientEmail, phone: d.clientPhone,
          stage: d.stage, brief: d.brief, budget: d.budget, fee: d.fee, feeType: d.feeType,
          preferredSuburbs: d.preferredSuburbs, agreementStatus: d.agreementStatus,
        };

        // Tasks + offers belong to the journeys module (already permitted here).
        const [tasks, offers] = await Promise.all([
          Task.find({ dealId }, { title: 1, type: 1, dueDate: 1, completed: 1, priority: 1 }).limit(20).lean(),
          Offer.find({ dealId }, { amount: 1, status: 1, dateSubmitted: 1, propertyId: 1 }).limit(20).lean(),
        ]);
        result.tasks = tasks.map((t) => ({
          id: id(t), title: t.title, type: t.type, dueDate: t.dueDate, completed: t.completed, priority: t.priority,
        }));
        result.offers = offers.map((o) => ({
          id: id(o), amount: o.amount, status: o.status, dateSubmitted: o.dateSubmitted, propertyId: o.propertyId,
        }));

        if (can.has('properties')) {
          const props = await Property.find({ dealId }, { address: 1, suburb: 1, status: 1, price: 1 }).limit(25).lean();
          result.properties = props.map((p) => ({
            id: id(p), address: p.address, suburb: p.suburb, status: p.status, price: p.price,
          }));
        }
        if (can.has('invoices')) {
          const invs = await Invoice.find({ dealId }, { invoiceNumber: 1, type: 1, total: 1, status: 1, dueDate: 1 }).limit(25).lean();
          result.invoices = invs.map((i) => ({
            id: id(i), number: i.invoiceNumber, type: i.type, total: i.total, status: i.status, dueDate: i.dueDate,
          }));
        }
        return result;
      },
    }),

    listProperties: tool({
      description: 'List properties. Optionally filter by status and/or suburb fragment. Returns compact rows.',
      inputSchema: z.object({
        status: z.enum(PROPERTY_STATUS).optional(),
        suburb: z.string().optional(),
        limit: z.number().optional(),
      }),
      execute: async ({ status, suburb, limit }) => {
        if (!can.has('properties')) return deny('Properties');
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        if (suburb) filter.suburb = rx(suburb);
        const rows = await Property.find(filter, {
          address: 1, suburb: 1, status: 1, price: 1, bedrooms: 1, dealId: 1,
        }).sort({ updatedAt: -1 }).limit(clampLimit(limit)).lean();
        return {
          count: rows.length,
          properties: rows.map((p) => ({
            id: id(p), address: p.address, suburb: p.suburb, status: p.status, price: p.price, bedrooms: p.bedrooms,
          })),
        };
      },
    }),

    listInvoices: tool({
      description: 'List invoices. Optionally filter by status (draft/sent/paid/overdue). Returns compact rows + totals.',
      inputSchema: z.object({
        status: z.enum(INVOICE_STATUS).optional(),
        limit: z.number().optional(),
      }),
      execute: async ({ status, limit }) => {
        if (!can.has('invoices')) return deny('Invoices');
        const filter: Record<string, unknown> = {};
        if (status) filter.status = status;
        const rows = await Invoice.find(filter, {
          invoiceNumber: 1, type: 1, total: 1, status: 1, dueDate: 1, dealId: 1,
        }).sort({ updatedAt: -1 }).limit(clampLimit(limit)).lean();
        return {
          count: rows.length,
          totalValue: rows.reduce((s, i) => s + (i.total ?? 0), 0),
          invoices: rows.map((i) => ({
            id: id(i), number: i.invoiceNumber, type: i.type, total: i.total, status: i.status, dueDate: i.dueDate,
          })),
        };
      },
    }),

    listAgents: tool({
      description: 'List real-estate agents. Optionally filter by geo area or preferred-only. Returns compact rows.',
      inputSchema: z.object({
        geo: z.enum(AGENT_GEO).optional(),
        preferredOnly: z.boolean().optional(),
        limit: z.number().optional(),
      }),
      execute: async ({ geo, preferredOnly, limit }) => {
        if (!can.has('agents')) return deny('Agents');
        const filter: Record<string, unknown> = {};
        if (geo) filter.geoTag = geo;
        if (preferredOnly) filter.isPreferred = true;
        const rows = await Agent.find(filter, {
          firstName: 1, lastName: 1, agency: 1, geoTag: 1, isPreferred: 1, email: 1, phone: 1,
        }).limit(clampLimit(limit)).lean();
        return {
          count: rows.length,
          agents: rows.map((a) => ({
            id: id(a), name: fullName(a), agency: a.agency, geo: a.geoTag, preferred: a.isPreferred,
            email: a.email, phone: a.phone,
          })),
        };
      },
    }),

    listTasks: tool({
      description: 'List tasks across journeys. Optionally filter by completion or due-before date (YYYY-MM-DD). Returns compact rows.',
      inputSchema: z.object({
        completed: z.boolean().optional().describe('Filter by completion state'),
        dueBefore: z.string().optional().describe('Only tasks due on or before this YYYY-MM-DD date'),
        limit: z.number().optional(),
      }),
      execute: async ({ completed, dueBefore, limit }) => {
        if (!can.has('journeys')) return deny('Buyer Journeys');
        const filter: Record<string, unknown> = {};
        if (typeof completed === 'boolean') filter.completed = completed;
        if (dueBefore) filter.dueDate = { $lte: dueBefore, $ne: '' };
        const rows = await Task.find(filter, {
          title: 1, type: 1, dueDate: 1, completed: 1, priority: 1, assignedTo: 1, dealId: 1,
        }).sort({ dueDate: 1 }).limit(clampLimit(limit)).lean();
        return {
          count: rows.length,
          tasks: rows.map((t) => ({
            id: id(t), title: t.title, type: t.type, dueDate: t.dueDate, completed: t.completed,
            priority: t.priority, journeyId: t.dealId,
          })),
        };
      },
    }),
  };
}
