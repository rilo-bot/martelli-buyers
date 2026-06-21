import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { request, ApiError } from '@/lib/api';
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Phone,
  MapPin,
  CheckCircle,
  Send,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ENQUIRY_TYPES = [
  'Buyer representation',
  'Off-market property search',
  'Property due diligence',
  'Auction bidding',
  'General enquiry',
] as const;

const BUDGET_RANGES = [
  'Under $750k',
  '$750k – $1.25m',
  '$1.25m – $2m',
  '$2m – $3.5m',
  '$3.5m – $5m',
  '$5m+',
] as const;

const CONTACT_DETAILS = [
  { icon: Mail, label: 'Email', value: 'hello@martellibuyers.com', href: 'mailto:hello@martellibuyers.com' },
  { icon: Phone, label: 'Phone', value: '+61 2 8000 0000', href: 'tel:+61280000000' },
  { icon: MapPin, label: 'Office', value: 'Sydney, NSW · By appointment', href: undefined },
];

interface FormState {
  name: string;
  email: string;
  phone: string;
  enquiryType: string;
  budget: string;
  location: string;
  message: string;
  consent: boolean;
}

const EMPTY_FORM: FormState = {
  name: '',
  email: '',
  phone: '',
  enquiryType: '',
  budget: '',
  location: '',
  message: '',
  consent: false,
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = 'Please enter your name.';
  if (!form.email.trim()) errors.email = 'Please enter your email.';
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = 'Enter a valid email address.';
  if (!form.enquiryType) errors.enquiryType = 'Select the type of enquiry.';
  if (!form.message.trim()) errors.message = 'Tell us a little about what you need.';
  if (!form.consent) errors.consent = 'Please accept the privacy terms to continue.';
  return errors;
}

export default function ContactUsPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update =
    <K extends keyof FormState>(key: K) =>
    (value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      toast.error('Please fix the highlighted fields.');
      return;
    }
    setSubmitting(true);
    try {
      // Lands in the CRM as a new lead (source "Website"). See server route
      // POST /api/public/contact.
      await request('POST', '/api/public/contact', {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        enquiryType: form.enquiryType,
        budget: form.budget,
        location: form.location.trim(),
        message: form.message.trim(),
        consent: form.consent,
      });
      setSubmitted(true);
      toast.success('Thanks — your enquiry has been received.');
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-12 lg:gap-16 items-start">
          {/* ── Left: intro + contact details ── */}
          <div className="lg:sticky lg:top-28">
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-primary mb-4">Get in touch</p>
            <h1
              className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-5 leading-[1.1]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Let&rsquo;s find your next property.
            </h1>
            <p className="text-muted-foreground leading-relaxed mb-10 max-w-md">
              Tell us about what you&rsquo;re looking for and a member of the Martelli &amp; Co team will be
              in touch — usually within one business day.
            </p>

            <ul className="space-y-5">
              {CONTACT_DETAILS.map((item) => (
                <li key={item.label} className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <item.icon className="h-[18px] w-[18px] text-primary" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground mb-0.5">
                      {item.label}
                    </p>
                    {item.href ? (
                      <a href={item.href} className="text-sm text-foreground hover:text-primary transition-colors">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-sm text-foreground">{item.value}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Right: form card ── */}
          <div className="rounded-2xl border border-border bg-card shadow-xl shadow-primary/5 p-7 md:p-10">
            {submitted ? (
              <div className="flex flex-col items-center text-center py-10">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-5">
                  <CheckCircle className="h-7 w-7 text-primary" />
                </div>
                <h2
                  className="text-2xl font-bold text-foreground mb-2"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Enquiry received
                </h2>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-8">
                  Thank you, {form.name.split(' ')[0] || 'there'}. We&rsquo;ve received your enquiry and
                  will be in touch shortly at {form.email}.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setSubmitted(false);
                  }}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" /> Send another enquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Full name" htmlFor="name" required error={errors.name}>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) => update('name')(e.target.value)}
                      placeholder="Jane Smith"
                      autoComplete="name"
                      aria-invalid={!!errors.name}
                    />
                  </Field>

                  <Field label="Email address" htmlFor="email" required error={errors.email}>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => update('email')(e.target.value)}
                      placeholder="jane@email.com"
                      autoComplete="email"
                      aria-invalid={!!errors.email}
                    />
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Phone" htmlFor="phone" error={errors.phone}>
                    <Input
                      id="phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update('phone')(e.target.value)}
                      placeholder="+61 4xx xxx xxx"
                      autoComplete="tel"
                    />
                  </Field>

                  <Field label="Type of enquiry" htmlFor="enquiryType" required error={errors.enquiryType}>
                    <Select
                      id="enquiryType"
                      value={form.enquiryType}
                      onChange={(e) => update('enquiryType')(e.target.value)}
                      aria-invalid={!!errors.enquiryType}
                    >
                      <option value="" disabled>
                        Select an option
                      </option>
                      {ENQUIRY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <div className="grid sm:grid-cols-2 gap-5">
                  <Field label="Budget range" htmlFor="budget">
                    <Select
                      id="budget"
                      value={form.budget}
                      onChange={(e) => update('budget')(e.target.value)}
                    >
                      <option value="">No preference</option>
                      {BUDGET_RANGES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Preferred location" htmlFor="location">
                    <Input
                      id="location"
                      value={form.location}
                      onChange={(e) => update('location')(e.target.value)}
                      placeholder="Suburb, region or postcode"
                    />
                  </Field>
                </div>

                <Field label="How can we help?" htmlFor="message" required error={errors.message}>
                  <Textarea
                    id="message"
                    value={form.message}
                    onChange={(e) => update('message')(e.target.value)}
                    placeholder="Tell us about the property you're after, your timeline, and anything else we should know…"
                    rows={5}
                    aria-invalid={!!errors.message}
                  />
                </Field>

                <div>
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.consent}
                      onChange={(e) => update('consent')(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary accent-[hsl(var(--primary))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground leading-relaxed">
                      I agree to be contacted about my enquiry and accept the handling of my details in line
                      with the Martelli &amp; Co privacy policy.
                    </span>
                  </label>
                  {errors.consent && (
                    <p className="mt-1.5 text-xs text-destructive">{errors.consent}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 font-semibold gap-2 shadow shadow-primary/25"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      Send enquiry <Send className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
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

/** Labelled form row with required marker and inline error — keeps the form markup flat. */
function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground"
      >
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className={cn('text-xs text-destructive')}>{error}</p>}
    </div>
  );
}
