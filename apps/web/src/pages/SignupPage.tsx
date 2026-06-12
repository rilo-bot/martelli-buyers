import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { useEmailTemplatesStore } from '@/stores/emailTemplatesStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, CheckCircle, Shield, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const BRAND_IMAGE = 'https://images.pexels.com/photos/6422937/pexels-photo-6422937.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const FEATURE_HIGHLIGHTS = [
  'Lead qualification & agreement signing',
  'Off-market property database & agent network',
  'Client portal with secure document collaboration',
  'Xero integration for milestone invoicing',
];

export default function SignupPage() {
  const navigate = useNavigate();
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const seedDefaultTemplates = useEmailTemplatesStore((s) => s.seedDefaultTemplates);
  const [step, setStep] = useState<'details' | 'code'>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setLoading(true);
    setError('');
    const result = await requestOtp(email, name);
    setLoading(false);
    if (result.ok) {
      setStep('code');
    } else {
      setError(result.error ?? 'Could not send a code.');
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) return;
    setLoading(true);
    setError('');
    const result = await verifyOtp(email, code.trim());
    setLoading(false);
    if (result.ok) {
      // Seed default email templates on the very first account.
      seedDefaultTemplates().catch(() => {});
      navigate('/dashboard');
    } else {
      setError(result.error ?? 'Invalid code.');
    }
  };

  const fieldClass = (field: string) =>
    cn(
      'h-12 px-4 rounded-xl border-2 bg-card text-sm transition-all duration-200',
      'placeholder:text-muted-foreground/40',
      focusedField === field
        ? 'border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]'
        : 'border-border hover:border-border/80'
    );

  const labelClass = (field: string) =>
    cn(
      'block text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors',
      focusedField === field ? 'text-primary' : 'text-muted-foreground'
    );

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative flex-col overflow-hidden">
        <img
          src={BRAND_IMAGE}
          alt="Luxury residential property at dusk"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink-deep)] via-[var(--ink-deep)]/50 to-[var(--ink-deep)]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--ink-deep)]/30" />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo mark */}
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Martelli Buyers" className="h-11 w-11 rounded-full bg-white object-contain shadow-lg" />
            <span className="text-sm font-bold tracking-wide" style={{ color: 'var(--paper-cream)' }}>
              Martelli Buyers CRM
            </span>
          </div>

          <div className="mt-auto space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'hsl(var(--primary))' }}>
                Built for boutique buyer agencies
              </p>
              <h1
                className="text-3xl xl:text-4xl font-bold leading-tight"
                style={{ color: 'var(--paper-cream)', fontFamily: 'var(--font-serif)' }}
              >
                A platform as<br />
                considered as<br />
                your clients.
              </h1>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(245, 240, 230, 0.65)' }}>
                From first lead to final paperwork — manage every step of the buyer journey in one secure place.
              </p>
            </div>

            {/* Feature list */}
            <ul className="space-y-2.5">
              {FEATURE_HIGHLIGHTS.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                  <span className="text-xs" style={{ color: 'rgba(245, 240, 230, 0.7)' }}>{f}</span>
                </li>
              ))}
            </ul>

            <div className="pt-2 border-t" style={{ borderColor: 'rgba(245, 240, 230, 0.1)' }}>
              <p className="text-[11px]" style={{ color: 'rgba(245, 240, 230, 0.35)' }}>
                © 2025 Martelli Buyers CRM · Boutique real estate intelligence
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ── */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden"
        style={{ background: 'hsl(var(--background))' }}
      >
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 70% 10%, hsl(var(--primary)) 0%, transparent 55%), radial-gradient(circle at 10% 90%, hsl(var(--accent)) 0%, transparent 50%)',
          }}
        />

        <div className="relative w-full max-w-[420px] space-y-7">
          {/* Mobile logo */}
          <div className="flex lg:hidden flex-col items-center gap-2">
            <img src="/images/logo.png" alt="Martelli Buyers" className="h-12 w-12 rounded-full object-contain shadow-lg" />
            <span className="text-sm font-bold text-foreground">Martelli Buyers CRM</span>
          </div>

          {/* Heading */}
          <div>
            <h2
              className="text-[28px] font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {step === 'details' ? 'Create your workspace' : 'Check your email'}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {step === 'details'
                ? 'Enter your details — we’ll email a one-time code to verify'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {/* Step 1 — details */}
          {step === 'details' && (
            <form onSubmit={handleRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="name" className={labelClass('name')}>Full name</label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={() => setFocusedField('name')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Your full name"
                  autoComplete="name"
                  className={fieldClass('name')}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className={labelClass('email')}>Work email</label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="you@martellibuyers.com"
                  autoComplete="email"
                  className={fieldClass('email')}
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/6 px-4 py-3">
                  <span className="mt-px h-4 w-4 shrink-0 rounded-full bg-destructive/15 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-destructive">!</span>
                  </span>
                  <p className="text-sm text-destructive leading-snug">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className={cn(
                  'w-full h-12 rounded-xl font-semibold text-sm tracking-wide mt-2',
                  'bg-primary text-primary-foreground',
                  'shadow-[0_4px_16px_hsl(var(--primary)/0.35)]',
                  'hover:shadow-[0_6px_24px_hsl(var(--primary)/0.45)] hover:-translate-y-px',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none'
                )}
                disabled={!name.trim() || !email.trim() || loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Sending code…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Send verification code
                    <Mail className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          )}

          {/* Step 2 — verify code */}
          {step === 'code' && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="code" className="block text-[11px] font-semibold tracking-[0.08em] uppercase text-muted-foreground">
                  6-digit code
                </label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  autoComplete="one-time-code"
                  className="h-12 px-4 rounded-xl border-2 bg-card text-center text-lg tracking-[0.5em] font-semibold border-border focus:border-primary"
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/6 px-4 py-3">
                  <span className="mt-px h-4 w-4 shrink-0 rounded-full bg-destructive/15 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-destructive">!</span>
                  </span>
                  <p className="text-sm text-destructive leading-snug">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className={cn(
                  'w-full h-12 rounded-xl font-semibold text-sm tracking-wide mt-2',
                  'bg-primary text-primary-foreground',
                  'shadow-[0_4px_16px_hsl(var(--primary)/0.35)]',
                  'hover:shadow-[0_6px_24px_hsl(var(--primary)/0.45)] hover:-translate-y-px',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none'
                )}
                disabled={code.length !== 6 || loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Verifying…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Create account
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setStep('details'); setCode(''); setError(''); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Edit your details
              </button>
            </form>
          )}

          {/* Security note */}
          <div className="flex items-center gap-2 justify-center">
            <Shield className="h-3.5 w-3.5 text-muted-foreground/50" />
            <p className="text-[11px] text-muted-foreground/50">
              Your data is encrypted and stored securely
            </p>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[11px] text-muted-foreground/60 tracking-wide">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Sign in link */}
          <div className="rounded-xl border border-border bg-muted/40 px-6 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Already a member?</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sign in to your workspace</p>
            </div>
            <Link
              to="/login"
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-semibold text-primary',
                'hover:gap-2.5 transition-all duration-150'
              )}
            >
              Sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}