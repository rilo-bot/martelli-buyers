# AI Agent — Martelli Buyers CRM

This document describes the two AI features in the CRM:

1. **Martelli Assistant** — a floating in-app chat guide that explains how to use
   the CRM, tailored to the signed-in user's permissions.
2. **Daily Briefing** — a role-aware, RBAC-scoped daily summary card on the
   dashboard.

Both reuse the same provider plumbing (OpenRouter via the Vercel AI SDK) and are
gated behind a single capability flag, so they disappear cleanly when AI is not
configured.

---

## 1. Overview

| | Martelli Assistant | Daily Briefing |
|---|---|---|
| **Where** | Floating ✨ bubble on every authenticated page | Card at the top of the Dashboard |
| **Purpose** | "How do I…" guidance **and** answering questions about your data | "What needs my attention today" summary |
| **Live data?** | Yes — read-only tools, RBAC-scoped | Yes — aggregate counts, RBAC-scoped |
| **Permission-aware?** | Yes — tools enforce per-user RBAC | Yes — only includes data the user may view |
| **Transport** | Streaming text (`POST /api/ai/assistant`) | JSON (`GET /api/ai/daily-summary`) |
| **AI call** | `streamText` + read tools (agentic, multi-step) | `generateObject` (structured) |
| **Caching** | None (live chat) | One per user per day (NZ date) |

---

## 2. Configuration

AI is configured **server-side only**; keys never reach the browser.

In `apps/server/.env`:

```bash
# Required to turn on all AI features.
OPENROUTER_API_KEY=sk-or-...

# Optional — defaults to google/gemini-2.5-flash.
OPENROUTER_MODEL=google/gemini-2.5-flash
```

- The server exposes a capability flag at `GET /api/config` → `{ hasAi: boolean, ... }`.
- The web client reads it via `useConfigStore()`; when `hasAi` is `false`, the
  assistant bubble and the briefing card render `null` (nothing appears).
- `hasAi` is derived in [`apps/server/src/env.ts`](../apps/server/src/env.ts) as
  `Boolean(OPENROUTER_API_KEY)`.

After setting the key, **restart the server**. No frontend rebuild is required.

---

## 3. Request flow

```
Browser                         Express (/api, requireAuth)            OpenRouter
───────                         ──────────────────────────            ──────────
Assistant widget  ──POST──▶  /api/ai/assistant
  messages+path                req.auth → describeCapabilities() + buildReadTools()
                               streamAssistantReply()      ──────────▶ streamText(tools)
                               ◀─ tool calls ─┐                        (model may call
                               execute (RBAC) ┘ ──────────▶            read tools, then
                          ◀── text/plain stream (piped)    ◀────────── answers in text)

Dashboard card    ──GET───▶  /api/ai/daily-summary
                               cache hit? → return cached
                               else: buildSnapshot(req.auth)  (RBAC-scoped DB reads)
                               generateBriefing()         ──────────▶ generateObject
                               cache + return JSON        ◀────────── { headline, insights, focus }
```

Every `/api` route runs behind `requireAuth`, which attaches
`req.auth = { user, permissions: Set<string>, isSuperAdmin }`. Both AI features
derive their access scope from `req.auth` — **the client never decides what the
model can see or describe.**

---

## 4. Martelli Assistant (agent)

### What it does
A floating chat panel that does two things:
1. **Guides** — explains how to use the CRM (navigation, the buyer-journey
   workflow, e-sign, emails, invoices/Xero, due diligence, how-to recipes, ⌘K).
2. **Answers about your data** — using read-only tools, it can answer questions
   like *"how many leads are open?"*, *"which journeys are stalled?"*, *"what's
   the status of the Smith journey?"* — scoped to what the user may view.

### How it works
- **Agentic tool calling**: `streamAssistantReply()` calls `streamText()` with a
  set of read tools and `stopWhen: stepCountIs(6)`. The model decides which
  tool(s) to call, the server executes them, and the model answers from the
  results — all in one streamed turn.
- **Read tools (RBAC-gated)**: built per request by `buildReadTools(auth)` in
  [`apps/server/src/lib/aiTools.ts`](../apps/server/src/lib/aiTools.ts). Each tool
  checks the caller's `viewableModules()` and returns a "no access" object if the
  role can't view that area. **Enforcement is in the tool, not the prompt**, so a
  jailbroken prompt cannot read past a role. There are **no write tools** — the
  agent is structurally read-only.

  | Tool | Permission | Purpose |
  |---|---|---|
  | `getDashboardMetrics` | dashboard | portal-wide aggregate counts |
  | `searchLeads` / `getLead` | `leads:view` | find/inspect leads |
  | `searchClients` / `getClient` | `clients:view` | find/inspect clients |
  | `listJourneys` / `getJourney` | `journeys:view` | journeys; detail folds in properties/offers/tasks/invoices (each gated by its own permission) |
  | `listProperties` | `properties:view` | properties by status/suburb |
  | `listInvoices` | `invoices:view` | invoices by status + totals |
  | `listAgents` | `agents:view` | agents by geo / preferred |
  | `listTasks` | `journeys:view` | tasks due/overdue, priority |

  Results are projected to compact fields and hard-capped (≤25 rows) to bound
  token cost. Search text is regex-escaped before querying.
- **Knowledge base**: a curated `CRM_GUIDE` constant in
  [`apps/server/src/lib/assistant.ts`](../apps/server/src/lib/assistant.ts) — the
  **single source of truth** for how-to answers; the agent may not invent
  features or routes.
- **RBAC tailoring**: `describeCapabilities()` injects a plain-language "Your
  access" block so the agent only explains actions the user may perform.
- **Deep links**: replies use markdown links to real routes (e.g. `[Leads](/leads)`);
  the widget turns in-app links into SPA navigation.
- **Streaming**: piped with `result.pipeTextStreamToResponse(res)`. Tool steps
  run server-side and invisibly; only the final answer streams to the client.

### Operating guidelines
The agent's system prompt embeds a fixed governance block (`GUIDELINES` in
`assistant.ts`):
1. **Read-only** — never changes/creates/sends/signs anything; gives steps for
   "how do I change X".
2. **Respect permissions** — answers about data only via tools; relays "no
   access" when a tool denies.
3. **No fabrication** — states only what tools/guide return; admits unknowns.
4. **Use tools for data** — calls tools for any question about real records.
5. **Privacy** — surfaces only data the user can already see; no bulk PII export.
6. **Style** — concise, cites real names/counts, deep-links, no emojis.

### Endpoint
`POST /api/ai/assistant`

```jsonc
// Request
{
  "messages": [
    { "role": "user", "content": "Which buyer journeys are stalled?" }
  ],
  "currentPath": "/dashboard"   // optional; the page the user is viewing
}
// Response: text/plain stream (chunked). 503 if AI is not configured.
```

- History is capped server-side to the last **12** messages; each `content` is
  capped at **4000** chars (Zod-validated).
- `currentPath` lets the assistant give context-aware answers.

### Maintaining the agent
- **How-to knowledge** → update `CRM_GUIDE` in `assistant.ts` (keep status/stage
  enums in sync with `apps/server/src/models.ts`).
- **Data access** → add/adjust tools in `aiTools.ts`; always RBAC-gate `execute`
  and keep results compact + capped. Never add a tool that writes.

---

## 5. Daily Briefing

### What it does
A dashboard card titled **"Your daily briefing"** that summarises what needs
attention today: a one-line headline, 3–5 prioritised insights (each optionally
deep-linked), and a "Focus today" suggestion.

### RBAC scoping (why each role sees something different)
[`buildSnapshot()`](../apps/server/src/lib/portalData.ts) (shared with the
assistant's `getDashboardMetrics` tool) gathers aggregate counts per area, but
**only for modules the user can view** (via `viewableModules()`, which checks
`<module>:view` against `req.auth`). Examples:

- A **manager/admin** with full view access gets leads, journeys, tasks,
  invoices, properties, clients and agents — and the prompt frames it around
  pipeline health, revenue and stalled work.
- A **staff member without `invoices:view`** never has invoice data gathered, so
  invoices are simply absent from their briefing — the prompt is also framed
  around their immediate follow-ups and tasks.

The model is instructed to base every statement only on the supplied metrics and
never mention areas that are absent. Deep links are validated against an
allow-list of real routes; anything else is dropped.

### Data gathered (when permitted)
| Module permission | Metrics |
|---|---|
| `leads:view` | total, open (new/contacted), idle 3+ days, won in last 7 days |
| `journeys:view` | active journeys by stage, stalled 7+ days, agreements awaiting signature; open tasks, due/overdue, high priority |
| `invoices:view` | overdue count + amount, drafts |
| `properties:view` | tracked, shortlisted/viewed, offers placed |
| `clients:view` | total clients |
| `agents:view` | network size, preferred count |

All metrics are **aggregate counts** — no raw client PII is sent to the model.

### Caching & cost
- One briefing is generated **per user per NZ day** and stored in the
  `DailySummary` collection.
- The first dashboard visit of the day generates it; subsequent visits return the
  cached copy. A **refresh** button forces regeneration with current data and
  permissions (`?refresh=1`).
- No cron job and no per-load AI spend.
- The web store (`dailySummaryStore`) also caches within the session so it does
  not re-fetch on every dashboard navigation.

### Endpoint
`GET /api/ai/daily-summary` (optional `?refresh=1`)

```jsonc
// Response
{
  "date": "2026-06-14",          // YYYY-MM-DD, Pacific/Auckland
  "role": "manager",
  "headline": "A steady day with two journeys needing a nudge.",
  "insights": [
    { "text": "3 leads have been idle for 3+ days — follow up.", "to": "/leads" },
    { "text": "2 invoices are overdue ($4,500).", "to": "/invoices" }
  ],
  "focus": "Chase the two stalled journeys before end of day.",
  "generatedAt": "2026-06-14T20:11:05.000Z",
  "cached": true
}
// 503 if AI is not configured.
```

---

## 6. File reference

### Backend (`apps/server/src`)
| File | Responsibility |
|---|---|
| [`lib/assistant.ts`](../apps/server/src/lib/assistant.ts) | `CRM_GUIDE` + `GUIDELINES` + `streamAssistantReply()` (agentic, RBAC-aware) |
| [`lib/aiTools.ts`](../apps/server/src/lib/aiTools.ts) | `buildReadTools(auth)` — RBAC-gated read-only data tools |
| [`lib/portalData.ts`](../apps/server/src/lib/portalData.ts) | `buildSnapshot()` (RBAC-scoped) + `snapshotToLines()`; shared by briefing + metrics tool |
| [`lib/dailySummary.ts`](../apps/server/src/lib/dailySummary.ts) | `generateBriefing()`, `getDailySummary()` (cache) |
| [`lib/permissions.ts`](../apps/server/src/lib/permissions.ts) | `authContextFromRequest()`, `viewableModules()`, `describeCapabilities()` |
| [`routes/ai.ts`](../apps/server/src/routes/ai.ts) | `POST /api/ai/assistant`, `GET /api/ai/daily-summary` (+ existing `/summarize`) |
| [`models.ts`](../apps/server/src/models.ts) | `DailySummary` cache model |
| [`env.ts`](../apps/server/src/env.ts) | `OPENROUTER_*` config + `hasAi` flag |

### Frontend (`apps/web/src`)
| File | Responsibility |
|---|---|
| [`components/Assistant.tsx`](../apps/web/src/components/Assistant.tsx) | Floating chat widget (streaming + markdown + deep links) |
| [`pages/dashboard/DailyBriefing.tsx`](../apps/web/src/pages/dashboard/DailyBriefing.tsx) | Briefing card |
| [`stores/dailySummaryStore.ts`](../apps/web/src/stores/dailySummaryStore.ts) | Fetch/refresh state for the briefing |
| [`App.tsx`](../apps/web/src/App.tsx) | Mounts `<Assistant/>` in the authed shell |
| [`pages/DashboardPage.tsx`](../apps/web/src/pages/DashboardPage.tsx) | Mounts `<DailyBriefing/>` |

---

## 7. Data model — `DailySummary`

```ts
{
  userId: string,        // owner
  date: string,          // 'YYYY-MM-DD' in Pacific/Auckland
  role: string,          // role at generation time
  headline: string,
  insights: { text: string, to: string }[],  // `to` is an in-app route or ''
  focus: string,
  generatedAt: string,   // ISO timestamp
}
// Unique compound index on (userId, date).
```

Not a CRUD resource — it is served read-only via `GET /api/ai/daily-summary` and
written only by the generation step.

---

## 8. Security & privacy

- **Server-authoritative RBAC**: scope is computed from `req.auth` (the session's
  effective permissions), never from client input.
- **Tool-layer enforcement**: each read tool re-checks `viewableModules(auth)` in
  `execute`; a jailbroken prompt cannot read data the role can't see.
- **Read-only by construction**: only read tools exist — there is no tool that can
  create, edit, delete, send or sign anything.
- **Keys stay server-side**: the OpenRouter key is never exposed to the browser.
- **Assistant data** is limited to what the user could already view in the app,
  returned as compact, capped results (no bulk PII export).
- **Briefing** sends only aggregate counts (no names, emails, or record contents).
- Both endpoints sit behind `requireAuth`; unauthenticated requests get `401`.

---

## 9. Extending / future enhancements

Delivered:
- **Data-aware chat** ✅ — the assistant is now an agent with RBAC-scoped read
  tools (Phase A).

Planned next (each a small, isolated change):
- **Phase B — Ask-your-data on the dashboard** — a natural-language box that opens
  the agent with a question; requires lifting the widget into an `assistantStore`.
- **Phase C — Richer briefing** — week-over-week trends, an `alerts` (proactive)
  section and ranked `actions`, with per-role framing.
- **Personal (assigned-to-me) briefing** — filter metrics by the user's assigned
  records in addition to module-level RBAC.
- **TTL on `DailySummary`** — auto-purge briefings older than N days.
- **Snapshot/tool query optimization** — switch `find().lean()` + in-memory
  filtering to `countDocuments`/aggregation if collections grow large.
- **Chat history persistence** — keep the assistant transcript across reloads.

---

## 10. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Assistant bubble / briefing card not visible | `OPENROUTER_API_KEY` not set, or server not restarted. Check `GET /api/config` returns `hasAi: true`. |
| `503` from an AI endpoint | AI not configured on the server. |
| `502` from `/daily-summary` | Generation failed (model/provider error). Use the refresh button to retry. |
| Assistant explains something a role can't do | Verify the role's permissions in Team & Roles; the prompt reflects `req.auth`. |
| Briefing shows the wrong day boundary | Day is computed in `Pacific/Auckland`; confirm the server has full ICU/timezone data. |
| Wrong status/stage names in answers | Update `CRM_GUIDE` in `assistant.ts` to match `models.ts` enums. |
```
