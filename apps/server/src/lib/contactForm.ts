import { randomBytes } from 'node:crypto';
import type {
  ContactFormConfig,
  ContactFormField,
  ContactFormFieldType,
  ContactFormStyles,
  ContactFormContent,
  ContactFormFont,
  ContactFormLayout,
  ContactFormShadow,
  ContactFormLabelStyle,
  ContactFormButtonStyle,
  PublicContactForm,
} from '@rilo/shared';
import {
  CONTACT_FORM_FIELD_CATALOG,
  CONTACT_FORM_STYLE_DEFAULTS,
  CONTACT_FORM_CONTENT_DEFAULTS,
  CONTACT_FORM_SYSTEM_KEYS,
  CONTACT_FORM_LOCKED_KEYS,
} from '@rilo/shared';

/** Thrown on any invalid config or submission → mapped to a 400 by the routes. */
export class ContactFormError extends Error {}

/* ── validation primitives ─────────────────────────────────────────────── */

const HEX = /^#[0-9a-fA-F]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/;
const FIELD_TYPES: ContactFormFieldType[] = ['text', 'email', 'tel', 'textarea', 'select', 'checkbox'];
const FONTS: ContactFormFont[] = ['sans', 'serif', 'mono', 'display'];
const LAYOUTS: ContactFormLayout[] = ['one-column', 'two-column'];
const SHADOWS: ContactFormShadow[] = ['none', 'sm', 'md', 'lg'];
const LABEL_STYLES: ContactFormLabelStyle[] = ['top', 'placeholder'];
const BUTTON_STYLES: ContactFormButtonStyle[] = ['solid', 'outline'];

/** Clamp a numeric style value, falling back to a default when not finite. */
function clampNum(v: unknown, min: number, max: number, fallback: number): number {
  let n = Number(v);
  if (!Number.isFinite(n)) n = fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Bounds — keep the settings document and each submission small.
const MAX_FIELDS = 40;
const MAX_OPTIONS = 30;
const MAX_OPTION_LEN = 120;
const MAX_LABEL = 200;
const MAX_PLACEHOLDER = 200;
const MAX_CONTENT = 2000;
const MAX_ORIGINS = 30;
const MAX_DETAILS = 10;
/** Per-field cap on a submitted value. */
const MAX_SUBMIT_VALUE = 5000;

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

const isSystemKey = (k: string): boolean => (CONTACT_FORM_SYSTEM_KEYS as readonly string[]).includes(k);
const isLockedKey = (k: string): boolean => (CONTACT_FORM_LOCKED_KEYS as readonly string[]).includes(k);

/** A fresh publishable key. Not a secret — only grants form read + submit. */
export function makeFormToken(): string {
  return `cf_live_${randomBytes(18).toString('hex')}`;
}

/* ── config sanitisation (admin builder → stored config) ────────────────── */

function sanitizeField(raw: unknown, idx: number, seen: Set<string>): ContactFormField {
  if (!raw || typeof raw !== 'object') throw new ContactFormError(`Field ${idx + 1} is invalid.`);
  const f = raw as Record<string, unknown>;

  const key = str(f.key, 40);
  if (!KEY_RE.test(key)) throw new ContactFormError(`Field ${idx + 1} has an invalid key.`);
  if (seen.has(key)) throw new ContactFormError(`Duplicate field key "${key}".`);
  seen.add(key);

  const type =
    typeof f.type === 'string' && FIELD_TYPES.includes(f.type as ContactFormFieldType)
      ? (f.type as ContactFormFieldType)
      : 'text';

  const label = str(f.label, MAX_LABEL);
  if (!label) throw new ContactFormError(`Field "${key}" needs a label.`);

  let options: string[] | undefined;
  if (type === 'select') {
    const arr = Array.isArray(f.options) ? f.options : [];
    options = arr.map((o) => str(o, MAX_OPTION_LEN)).filter(Boolean).slice(0, MAX_OPTIONS);
    if (!options.length) throw new ContactFormError(`Select field "${key}" needs at least one option.`);
  }

  let enabled = f.enabled === undefined ? true : Boolean(f.enabled);
  let required = Boolean(f.required);
  // name + email are mandatory: an enquiry is useless without them.
  if (isLockedKey(key)) {
    enabled = true;
    required = true;
  }

  return {
    key,
    type,
    label,
    placeholder: str(f.placeholder, MAX_PLACEHOLDER),
    required,
    enabled,
    ...(options ? { options } : {}),
    system: isSystemKey(key),
    ...(f.fullWidth === false ? { fullWidth: false } : {}),
  };
}

export function sanitizeContactFormFields(raw: unknown): ContactFormField[] {
  if (!Array.isArray(raw)) throw new ContactFormError('Fields must be a list.');
  if (raw.length > MAX_FIELDS) throw new ContactFormError(`A form cannot exceed ${MAX_FIELDS} fields.`);

  const seen = new Set<string>();
  const fields = raw.map((f, i) => sanitizeField(f, i, seen));

  // Guarantee the locked fields exist even if the client dropped them.
  for (const lockKey of CONTACT_FORM_LOCKED_KEYS) {
    if (!seen.has(lockKey)) {
      const def = CONTACT_FORM_FIELD_CATALOG.find((c) => c.key === lockKey);
      if (def) fields.unshift({ ...def, options: def.options ? [...def.options] : undefined });
    }
  }
  if (!fields.some((f) => f.enabled)) throw new ContactFormError('Keep at least one field enabled.');
  return fields;
}

export function sanitizeContactFormStyles(raw: unknown): ContactFormStyles {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const color = (v: unknown, fallback: string): string => {
    const c = str(v, 7);
    return HEX.test(c) ? c.toLowerCase() : fallback;
  };
  const font =
    typeof s.font === 'string' && FONTS.includes(s.font as ContactFormFont) ? (s.font as ContactFormFont) : 'sans';
  const layout =
    typeof s.layout === 'string' && LAYOUTS.includes(s.layout as ContactFormLayout)
      ? (s.layout as ContactFormLayout)
      : 'two-column';
  const shadow =
    typeof s.shadow === 'string' && SHADOWS.includes(s.shadow as ContactFormShadow)
      ? (s.shadow as ContactFormShadow)
      : CONTACT_FORM_STYLE_DEFAULTS.shadow;
  const labelStyle =
    typeof s.labelStyle === 'string' && LABEL_STYLES.includes(s.labelStyle as ContactFormLabelStyle)
      ? (s.labelStyle as ContactFormLabelStyle)
      : CONTACT_FORM_STYLE_DEFAULTS.labelStyle;
  const buttonStyle =
    typeof s.buttonStyle === 'string' && BUTTON_STYLES.includes(s.buttonStyle as ContactFormButtonStyle)
      ? (s.buttonStyle as ContactFormButtonStyle)
      : CONTACT_FORM_STYLE_DEFAULTS.buttonStyle;

  return {
    accentColor: color(s.accentColor, CONTACT_FORM_STYLE_DEFAULTS.accentColor),
    backgroundColor: color(s.backgroundColor, CONTACT_FORM_STYLE_DEFAULTS.backgroundColor),
    surfaceColor: color(s.surfaceColor, CONTACT_FORM_STYLE_DEFAULTS.surfaceColor),
    textColor: color(s.textColor, CONTACT_FORM_STYLE_DEFAULTS.textColor),
    buttonTextColor: color(s.buttonTextColor, CONTACT_FORM_STYLE_DEFAULTS.buttonTextColor),
    borderColor: color(s.borderColor, CONTACT_FORM_STYLE_DEFAULTS.borderColor),
    font,
    cornerRadius: clampNum(s.cornerRadius, 0, 32, CONTACT_FORM_STYLE_DEFAULTS.cornerRadius),
    maxWidth: clampNum(s.maxWidth, 320, 1200, CONTACT_FORM_STYLE_DEFAULTS.maxWidth),
    padding: clampNum(s.padding, 0, 64, CONTACT_FORM_STYLE_DEFAULTS.padding),
    borderWidth: clampNum(s.borderWidth, 0, 8, CONTACT_FORM_STYLE_DEFAULTS.borderWidth),
    shadow,
    layout,
    labelStyle,
    buttonStyle,
    showLogo: s.showLogo === undefined ? true : Boolean(s.showLogo),
  };
}

export function sanitizeContactFormContent(raw: unknown): ContactFormContent {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const details = (Array.isArray(c.contactDetails) ? c.contactDetails : [])
    .slice(0, MAX_DETAILS)
    .map((d) => {
      const o = (d && typeof d === 'object' ? d : {}) as Record<string, unknown>;
      return { label: str(o.label, 60), value: str(o.value, 200), href: str(o.href, 300) };
    })
    .filter((d) => d.label || d.value);

  return {
    eyebrow: str(c.eyebrow, 80),
    heading: str(c.heading, 200),
    intro: str(c.intro, MAX_CONTENT),
    submitLabel: str(c.submitLabel, 60) || CONTACT_FORM_CONTENT_DEFAULTS.submitLabel,
    successHeading: str(c.successHeading, 120) || CONTACT_FORM_CONTENT_DEFAULTS.successHeading,
    successMessage: str(c.successMessage, MAX_CONTENT) || CONTACT_FORM_CONTENT_DEFAULTS.successMessage,
    contactDetails: details,
  };
}

/** Hostnames (no scheme/port/path), de-duplicated. Empty list = any origin. */
export function sanitizeAllowedOrigins(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new ContactFormError('Allowed origins must be a list.');
  const out: string[] = [];
  for (const item of raw.slice(0, MAX_ORIGINS)) {
    const host = str(item, 200)
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/.*$/, '')
      .replace(/:\d+$/, '');
    if (host) out.push(host);
  }
  return Array.from(new Set(out));
}

/** The editable slice of a config (everything except server-managed published/token). */
export interface ContactFormEditable {
  fields: ContactFormField[];
  styles: ContactFormStyles;
  content: ContactFormContent;
  allowedOrigins: string[];
}

export function sanitizeContactFormEditable(body: unknown): ContactFormEditable {
  if (!body || typeof body !== 'object') throw new ContactFormError('Invalid contact form payload.');
  const b = body as Record<string, unknown>;
  return {
    fields: sanitizeContactFormFields(b.fields),
    styles: sanitizeContactFormStyles(b.styles),
    content: sanitizeContactFormContent(b.content),
    allowedOrigins: sanitizeAllowedOrigins(b.allowedOrigins),
  };
}

/* ── public surface ─────────────────────────────────────────────────────── */

/** Is `origin` permitted by the allowlist? Empty allowlist = any origin. */
export function originAllowed(allowed: string[], origin: string | undefined): boolean {
  if (!allowed.length) return true;
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).hostname.toLowerCase();
  } catch {
    return false;
  }
  return allowed.some((a) => host === a || host.endsWith(`.${a}`));
}

/** Strip server-only fields and attach branding for the public renderer. */
export function toPublicForm(
  config: ContactFormConfig,
  branding: { logoDataUrl: string; firmName: string },
): PublicContactForm {
  return {
    fields: config.fields.filter((f) => f.enabled),
    styles: config.styles,
    content: config.content,
    logoDataUrl: config.styles.showLogo ? branding.logoDataUrl || '' : '',
    firmName: branding.firmName,
  };
}

/* ── submission validation (public submit → enquiry fields) ─────────────── */

export interface SubmissionResult {
  name: string;
  email: string;
  phone: string;
  enquiryType: string;
  budget: string;
  location: string;
  message: string;
  consent: boolean;
  /** Values for non-column fields (custom + extras), keyed by field key. */
  extraFields: Record<string, string>;
}

/**
 * Validate a submission against the *published* config and map it onto the
 * ContactEnquiry columns. Only enabled fields are considered; required/email/
 * select rules are enforced server-side so a crafted request can't bypass the
 * client. name + email are always required regardless of config.
 */
export function validateSubmission(config: ContactFormConfig, rawValues: unknown): SubmissionResult {
  const values = (rawValues && typeof rawValues === 'object' ? rawValues : {}) as Record<string, unknown>;
  const result: SubmissionResult = {
    name: '', email: '', phone: '', enquiryType: '', budget: '', location: '', message: '', consent: false,
    extraFields: {},
  };
  let lastNameVal = '';

  for (const field of config.fields) {
    if (!field.enabled) continue;
    const raw = values[field.key];

    if (field.type === 'checkbox') {
      const checked = raw === true || raw === 'true' || raw === 'on';
      if (field.required && !checked) throw new ContactFormError(`${field.label} is required.`);
      if (field.key === 'consent') result.consent = checked;
      else result.extraFields[field.label] = checked ? 'Yes' : 'No';
      continue;
    }

    const val = typeof raw === 'string' ? raw.trim().slice(0, MAX_SUBMIT_VALUE) : '';
    if (field.required && !val) throw new ContactFormError(`${field.label} is required.`);
    if (val && field.type === 'email' && !EMAIL_RE.test(val)) {
      throw new ContactFormError('Please enter a valid email address.');
    }
    if (val && field.type === 'select' && field.options && !field.options.includes(val)) {
      throw new ContactFormError(`Please choose a valid option for ${field.label}.`);
    }

    switch (field.key) {
      case 'name': result.name = val; break;
      case 'lastName': lastNameVal = val; break; // combined into name after the loop
      case 'email': result.email = val.toLowerCase(); break;
      case 'phone': result.phone = val; break;
      case 'enquiryType': result.enquiryType = val; break;
      case 'budget': result.budget = val; break;
      case 'location': result.location = val; break;
      case 'message': result.message = val; break;
      // Non-column fields (custom + extras) are captured under their label so
      // they read cleanly in the enquiry and the converted lead's notes.
      default: if (val) result.extraFields[field.label] = val;
    }
  }

  // First + last name fields combine into the single enquiry `name` column.
  if (lastNameVal) result.name = `${result.name} ${lastNameVal}`.trim();

  if (!result.name) throw new ContactFormError('Name is required.');
  if (!EMAIL_RE.test(result.email)) throw new ContactFormError('A valid email is required.');
  return result;
}
