import { useMemo, useRef, useState, type CSSProperties } from 'react'
import type { PublicContactForm, ContactFormField, ContactFormFont, ContactFormShadow } from '@rilo/shared'
import { submitPublicForm } from '@/lib/contactFormApi'
import { ApiError } from '@/lib/api'

const FONT_STACK: Record<ContactFormFont, string> = {
  sans: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
  mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  display: '"League Spartan", "Inter", ui-sans-serif, system-ui, sans-serif',
}

/** The heading always uses the brand display face for a consistent look. */
const HEADING_FONT = '"League Spartan", "Inter", ui-sans-serif, system-ui, sans-serif'

const SHADOW: Record<ContactFormShadow, string> = {
  none: 'none',
  sm: '0 1px 2px rgba(0,0,0,.06)',
  md: '0 10px 30px rgba(0,0,0,.08)',
  lg: '0 24px 50px rgba(0,0,0,.14)',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Values = Record<string, string | boolean>

function initialValues(fields: ContactFormField[]): Values {
  const v: Values = {}
  for (const f of fields) v[f.key] = f.type === 'checkbox' ? false : ''
  return v
}

/** Client-side mirror of the server's submission validation. */
function validate(fields: ContactFormField[], values: Values): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const f of fields) {
    const val = values[f.key]
    if (f.type === 'checkbox') {
      if (f.required && val !== true) errors[f.key] = 'This is required.'
      continue
    }
    const s = typeof val === 'string' ? val.trim() : ''
    if (f.required && !s) errors[f.key] = `${f.label} is required.`
    else if (s && f.type === 'email' && !EMAIL_RE.test(s)) errors[f.key] = 'Enter a valid email address.'
  }
  return errors
}

export interface ContactFormRendererProps {
  config: PublicContactForm
  /** Submit target: a token for an embed, `null` for the firm's hosted page. */
  token?: string | null
  /** Render only — no network submit (used by the Settings live preview). */
  preview?: boolean
}

/**
 * Self-contained, token-styled contact form. Independent of the app theme so it
 * renders identically on the hosted /contact-us page, inside the embed iframe,
 * and in the Settings preview. All colours/fonts/radius come from the config.
 */
export function ContactFormRenderer({ config, token, preview = false }: ContactFormRendererProps) {
  const { fields, styles, content } = config
  const [values, setValues] = useState<Values>(() => initialValues(fields))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const honeypot = useRef('')
  const mountedAt = useRef(Date.now())

  const rootStyle = useMemo<CSSProperties>(
    () =>
      ({
        '--cf-accent': styles.accentColor,
        '--cf-surface': styles.surfaceColor,
        '--cf-text': styles.textColor,
        '--cf-btn-text': styles.buttonTextColor,
        '--cf-border-color': styles.borderColor,
        '--cf-radius': `${styles.cornerRadius}px`,
        '--cf-max-width': `${styles.maxWidth}px`,
        '--cf-padding': `${styles.padding}px`,
        '--cf-border-width': `${styles.borderWidth}px`,
        '--cf-shadow': SHADOW[styles.shadow] ?? SHADOW.md,
        '--cf-heading-font': HEADING_FONT,
        background: styles.backgroundColor,
        color: styles.textColor,
        fontFamily: FONT_STACK[styles.font] ?? FONT_STACK.sans,
      }) as CSSProperties,
    [styles],
  )

  const gridCols = styles.layout === 'two-column' ? 'repeat(2, minmax(0, 1fr))' : '1fr'

  const setValue = (key: string, value: string | boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    const found = validate(fields, values)
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    if (preview) {
      setSubmitted(true)
      return
    }
    setSubmitting(true)
    try {
      await submitPublicForm(token ?? null, {
        values,
        _hp: honeypot.current,
        _elapsedMs: Date.now() - mountedAt.current,
      })
      setSubmitted(true)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setValues(initialValues(fields))
    setErrors({})
    setFormError('')
    setSubmitted(false)
    mountedAt.current = Date.now()
  }

  return (
    <div className="cf-root" style={rootStyle}>
      <style>{CF_CSS}</style>
      <div className="cf-card">
        {(styles.showLogo && (config.logoDataUrl || config.firmName)) && (
          <div className="cf-brand">
            {config.logoDataUrl ? (
              <img src={config.logoDataUrl} alt={config.firmName || 'Logo'} className="cf-logo" />
            ) : (
              <span className="cf-wordmark">{config.firmName}</span>
            )}
          </div>
        )}

        {submitted ? (
          <div className="cf-success">
            <div className="cf-success-badge">✓</div>
            <h2 className="cf-heading">{content.successHeading}</h2>
            <p className="cf-intro">{content.successMessage}</p>
            <button type="button" className="cf-btn cf-btn-outline" onClick={reset}>
              Send another enquiry
            </button>
          </div>
        ) : (
          <>
            {content.eyebrow && <p className="cf-eyebrow">{content.eyebrow}</p>}
            {content.heading && <h1 className="cf-heading">{content.heading}</h1>}
            {content.intro && <p className="cf-intro">{content.intro}</p>}

            {content.contactDetails.length > 0 && (
              <ul className="cf-contacts">
                {content.contactDetails.map((d, i) => (
                  <li key={i}>
                    {d.label && <span className="cf-contact-label">{d.label}</span>}
                    {d.href ? (
                      <a href={d.href} className="cf-contact-value">
                        {d.value}
                      </a>
                    ) : (
                      <span className="cf-contact-value">{d.value}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <form onSubmit={handleSubmit} noValidate className="cf-form">
              {/* Honeypot — hidden from humans, tempting to bots. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="cf-hp"
                onChange={(e) => (honeypot.current = e.target.value)}
              />

              <div className="cf-grid" style={{ gridTemplateColumns: gridCols }}>
                {fields.map((f) => (
                  <FieldControl
                    key={f.key}
                    field={f}
                    labelStyle={styles.labelStyle}
                    value={values[f.key]}
                    error={errors[f.key]}
                    onChange={(v) => setValue(f.key, v)}
                  />
                ))}
              </div>

              {formError && <p className="cf-form-error">{formError}</p>}

              <button
                type="submit"
                className={`cf-btn${styles.buttonStyle === 'outline' ? ' cf-btn-outline-main' : ''}`}
                disabled={submitting}
              >
                {submitting ? 'Sending…' : content.submitLabel}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

function FieldControl({
  field,
  labelStyle,
  value,
  error,
  onChange,
}: {
  field: ContactFormField
  labelStyle: PublicContactForm['styles']['labelStyle']
  value: string | boolean
  error?: string
  onChange: (v: string | boolean) => void
}) {
  // Checkbox (e.g. consent) spans the full grid and shows the label beside the box.
  if (field.type === 'checkbox') {
    return (
      <div className="cf-cell cf-cell-full">
        <label className="cf-check">
          <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
          <span>
            {field.label}
            {field.required && <span className="cf-req"> *</span>}
          </span>
        </label>
        {error && <p className="cf-error">{error}</p>}
      </div>
    )
  }

  const id = `cf-${field.key}`
  // In two-column layout a field is half-width only when fullWidth === false.
  const isFull = field.type === 'textarea' || field.fullWidth !== false
  const placeholderMode = labelStyle === 'placeholder'
  // In placeholder mode the label doubles as the input placeholder.
  const placeholder = field.placeholder || (placeholderMode ? field.label : '')

  return (
    <div className={`cf-cell${isFull ? ' cf-cell-full' : ''}`}>
      {!placeholderMode && (
        <label htmlFor={id} className="cf-field-label">
          {field.label}
          {field.required && <span className="cf-req"> *</span>}
        </label>
      )}
      {field.type === 'textarea' ? (
        <textarea
          id={id}
          className="cf-textarea"
          rows={5}
          value={String(value)}
          placeholder={placeholder}
          aria-label={field.label}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : field.type === 'select' ? (
        <select
          id={id}
          className={`cf-select${String(value) === '' ? ' cf-select-empty' : ''}`}
          value={String(value)}
          aria-label={field.label}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">{placeholder || 'Select an option…'}</option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          type={field.type}
          className="cf-input"
          value={String(value)}
          placeholder={placeholder}
          aria-label={field.label}
          aria-invalid={!!error}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {error && <p className="cf-error">{error}</p>}
    </div>
  )
}

const CF_CSS = `
.cf-root { width: 100%; padding: 24px; box-sizing: border-box; }
.cf-root * { box-sizing: border-box; }
.cf-card { max-width: var(--cf-max-width); margin: 0 auto; background: var(--cf-surface);
  border: var(--cf-border-width) solid var(--cf-border-color); border-radius: calc(var(--cf-radius) + 6px);
  padding: var(--cf-padding); box-shadow: var(--cf-shadow); }
.cf-brand { margin-bottom: 22px; }
.cf-logo { max-height: 44px; width: auto; }
.cf-wordmark { font-size: 18px; font-weight: 700; font-family: var(--cf-heading-font); }
.cf-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .18em; text-transform: uppercase;
  color: var(--cf-accent); margin: 0 0 10px; }
.cf-heading { font-family: var(--cf-heading-font); font-size: 32px; font-weight: 500; line-height: 1.1;
  letter-spacing: .01em; text-transform: uppercase; margin: 0 0 18px; }
.cf-intro { font-size: 15px; line-height: 1.6; opacity: .85; margin: 0 0 8px; }
.cf-contacts { list-style: none; padding: 0; margin: 0 0 26px; display: flex; flex-direction: column; gap: 6px; }
.cf-contacts li { display: flex; flex-direction: column; }
.cf-contact-label { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; opacity: .55; }
.cf-contact-value { font-size: 15px; color: inherit; text-decoration: none; }
.cf-contact-value:hover { color: var(--cf-accent); }
.cf-form { display: block; }
.cf-grid { display: grid; gap: 12px; }
.cf-cell { display: flex; flex-direction: column; min-width: 0; }
.cf-cell-full { grid-column: 1 / -1; }
.cf-field-label { font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase;
  opacity: .7; margin-bottom: 6px; }
.cf-req { color: #dc2626; }
.cf-input, .cf-textarea, .cf-select { width: 100%; padding: 14px 16px; font-size: 15px; font-family: inherit;
  color: var(--cf-text); background: #fff; border: 1px solid var(--cf-border-color, rgba(0,0,0,.18)); border-radius: var(--cf-radius);
  outline: none; transition: border-color .15s, box-shadow .15s; }
.cf-input::placeholder, .cf-textarea::placeholder { color: color-mix(in srgb, var(--cf-text) 50%, transparent); }
.cf-textarea { resize: vertical; min-height: 120px; }
.cf-input:focus, .cf-textarea:focus, .cf-select:focus { border-color: var(--cf-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--cf-accent) 22%, transparent); }
.cf-input[aria-invalid="true"], .cf-textarea[aria-invalid="true"], .cf-select[aria-invalid="true"] { border-color: #dc2626; }
.cf-check { display: flex; align-items: flex-start; gap: 12px; cursor: pointer; font-size: 13px; line-height: 1.55; opacity: .85; margin: 8px 0 4px; }
.cf-check input { margin-top: 1px; width: 20px; height: 20px; accent-color: var(--cf-accent); flex: 0 0 auto; }
.cf-error { color: #dc2626; font-size: 12px; margin: 4px 0 0; }
.cf-form-error { color: #dc2626; font-size: 13px; margin: 14px 0 0; }
.cf-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
.cf-btn { margin-top: 16px; width: 100%; padding: 15px 16px; font-size: 15px; font-weight: 500; font-family: inherit;
  letter-spacing: .02em; color: var(--cf-btn-text); background: var(--cf-accent); border: 1px solid var(--cf-accent);
  border-radius: var(--cf-radius); cursor: pointer; transition: filter .15s, background .15s; }
.cf-btn:hover { filter: brightness(.94); }
.cf-btn:disabled { opacity: .65; cursor: default; }
.cf-btn-outline-main { background: transparent; color: var(--cf-text); border-color: var(--cf-text); }
.cf-btn-outline-main:hover { filter: none; background: color-mix(in srgb, var(--cf-text) 7%, transparent); }
.cf-select-empty { color: color-mix(in srgb, var(--cf-text) 55%, transparent); }
.cf-btn-outline { background: transparent; color: var(--cf-accent); width: auto; padding: 10px 18px; }
.cf-success { text-align: center; padding: 24px 8px; }
.cf-success-badge { width: 52px; height: 52px; border-radius: 50%; margin: 0 auto 16px;
  display: flex; align-items: center; justify-content: center; font-size: 24px;
  color: var(--cf-accent); background: color-mix(in srgb, var(--cf-accent) 14%, transparent); }
`
