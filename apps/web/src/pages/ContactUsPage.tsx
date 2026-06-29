import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import type { PublicContactForm } from '@rilo/shared';
import { getPublicForm } from '@/lib/contactFormApi';
import { ContactFormRenderer } from '@/components/contact-form/ContactFormRenderer';

/**
 * The firm's own hosted contact page. Renders the admin-published form config
 * (the same config that powers the embeddable widget) inside the marketing
 * chrome. Submits same-origin via POST /api/public/form/submit (token = null).
 */
export default function ContactUsPage() {
  const [form, setForm] = useState<PublicContactForm | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPublicForm()
      .then((f) => active && setForm(f))
      .catch((e) => active && setError(e?.message || 'Could not load the contact form.'));
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="bg-background min-h-screen overflow-x-hidden font-sans">
      {/* ── Header ─────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur-md">
        <div className="max-w-screen-xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="brand-wordmark leading-none">
            <span className="block text-[16px] text-foreground">
              <span className="bw-name">Martelli</span> <span className="bw-co">&amp; Co</span>
            </span>
            <span className="brand-eyebrow mt-0.5 block text-[8px] text-muted-foreground">Buyers Agents</span>
          </Link>
          <Link to="/login">
            <Button size="sm" className="text-sm font-semibold px-5 shadow shadow-primary/20 gap-2">
              Sign In <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-6 py-14 md:py-20">
        {error ? (
          <p className="text-center text-sm text-destructive">{error}</p>
        ) : form ? (
          <ContactFormRenderer config={form} token={null} />
        ) : (
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        )}
      </main>

      {/* ── Footer ─────────────────────────────── */}
      <footer className="border-t border-border bg-card">
        <div className="max-w-screen-xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <Link to="/" className="brand-wordmark leading-none">
            <span className="block text-[13px] text-foreground">
              <span className="bw-name">Martelli</span> <span className="bw-co">&amp; Co</span>
            </span>
            <span className="brand-eyebrow mt-0.5 block text-[7px] text-muted-foreground">Buyers Agents</span>
          </Link>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Martelli Buyer Agency. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
