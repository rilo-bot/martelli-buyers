import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type { PublicContactForm } from '@rilo/shared'
import { getPublicForm } from '@/lib/contactFormApi'
import { ContactFormRenderer } from '@/components/contact-form/ContactFormRenderer'

/**
 * Chrome-less form host loaded inside the embed iframe (/embed/f/:token). Fetches
 * the published config and continuously reports its height to the parent page so
 * the embed.js loader can size the iframe. Never renders app chrome.
 */
export default function EmbedContactFormPage() {
  const { token = '' } = useParams()
  const [form, setForm] = useState<PublicContactForm | null>(null)
  const [error, setError] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    getPublicForm(token)
      .then((f) => active && setForm(f))
      .catch((e) => active && setError(e?.message || 'Form not found.'))
    return () => {
      active = false
    }
  }, [token])

  // Report height to the embedding page (embed.js) for iframe auto-resize.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const post = () => {
      const height = Math.ceil(el.getBoundingClientRect().height)
      window.parent?.postMessage({ type: 'rilo-contact-form-height', token, height }, '*')
    }
    post()
    const ro = new ResizeObserver(post)
    ro.observe(el)
    return () => ro.disconnect()
  }, [token, form, error])

  return (
    <div ref={rootRef} style={{ background: 'transparent' }}>
      {error ? (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', color: '#dc2626', fontSize: 14 }}>{error}</div>
      ) : form ? (
        <ContactFormRenderer config={form} token={token} />
      ) : (
        <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif', fontSize: 14, opacity: 0.6 }}>Loading…</div>
      )}
    </div>
  )
}
