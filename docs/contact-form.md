# Contact form (customisable + embeddable)

An admin-built public contact form. One form per org (single-tenant), stored on
`CompanySettings.contactForm`. The same published config drives **both** the
firm's hosted `/contact-us` page **and** an embeddable iframe widget that can be
dropped on any external website. Every submission becomes a `ContactEnquiry`
(status `new`) in the **Enquiries** inbox — never a Lead directly.

## Where to configure it

**Settings → Contact Form** (`settings:manage`). Four tabs:

- **Fields** — toggle predefined fields on/off, mark required, reorder, edit
  labels/placeholders/options, and add custom fields. `name` + `email` are
  locked (always on + required). Predefined fields can be hidden but not
  removed; custom fields can be removed.
- **Design** — accent / background / surface / text / button-text colours, font,
  corner radius, field layout (one/two column), show-logo toggle. Bounded,
  validated style tokens — not raw CSS.
- **Content** — eyebrow, heading, intro, submit label, success heading/message,
  and contact-detail rows.
- **Publish & embed** — publish/unpublish, the embed snippet + token, regenerate
  token, and the allowed-domains allowlist.

A live preview renders the draft beside the editor.

## How embedding works

```html
<script src="https://<api-host>/api/public/embed.js"
        data-form-token="cf_live_…" async></script>
```

`embed.js` reads `data-form-token`, injects an `<iframe>` pointing at
`https://<web-host>/embed/f/<token>` (a chrome-less host page), and auto-resizes
it from the iframe's `postMessage`. The iframe loads the published config from
`GET /api/public/form/:token` and submits to `POST /api/public/form/:token/submit`.

Style isolation comes for free — the form lives in its own iframe, so the host
site's CSS can't affect it and it can't read the host page.

## Endpoints

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/public/form` | none | Config for the hosted `/contact-us` page. |
| GET | `/api/public/form/:token` | none | Config for an embed; 404 unless published + token matches. |
| POST | `/api/public/form/submit` | none | Same-origin submit from the hosted page. |
| POST | `/api/public/form/:token/submit` | none | Embed submit; published + origin-allowlist gated. |
| GET | `/api/public/embed.js` | none | The loader script. |
| GET/PUT | `/api/company-settings/contact-form` | `settings:view` / `settings:manage` | Read / save editable config. |
| POST | `/api/company-settings/contact-form/{publish,unpublish,regenerate-token}` | `settings:manage` | Publish state + token. |

These public routes mount **before** the cookie-scoped CORS in `index.ts` so they
can use their own origin-reflecting CORS (embeds are cross-origin and send no
credentials). They also override helmet's `Cross-Origin-Resource-Policy`.

## Security

- **Token** is a *publishable* key (it ships in the snippet). It only grants
  form read + submit, never CRM data. Regenerate to revoke all live embeds.
- **Allowed domains** — when set, submissions are rejected unless the request
  Origin/Referer host matches. Empty = any origin.
- **Spam** — a hidden honeypot field + a minimum time-on-page heuristic silently
  drop bots; submissions are rate-limited (10/min/IP) and the body is capped at 64 KB.
- **Validation** — submissions are validated server-side against the *published*
  config (required/email/select-option rules); `name` + `email` are always
  required regardless of config.

## Notes for deployment

The web static host must allow framing of `/embed/*` (no `X-Frame-Options:
DENY/SAMEORIGIN`, no restrictive `frame-ancestors`). Render static sites set no
frame headers by default, so this works out of the box. `embed.js` bakes in
`CLIENT_ORIGIN` (the web origin) as the iframe target, so that env var must point
at the deployed web app.
