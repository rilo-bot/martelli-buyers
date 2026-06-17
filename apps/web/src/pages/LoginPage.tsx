import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, CheckCircle, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';

const BRAND_IMAGE = 'https://images.pexels.com/photos/6422937/pexels-photo-6422937.jpeg?auto=compress&cs=tinysrgb&h=650&w=940';

const TRUST_POINTS = [
  'Secure client portal with real-time collaboration',
  'Off-market property database & agent network',
  'Integrated due diligence & audit reporting',
];

export default function LoginPage() {
  const navigate = useNavigate();
  const requestOtp = useAuthStore((s) => s.requestOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const currentUser = useAuthStore((s) => s.currentUser);
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // If a session is already (or becomes) valid — e.g. a background reconnect
  // restored it after the API restarted — skip the login form entirely.
  useEffect(() => {
    if (currentUser) navigate('/dashboard', { replace: true });
  }, [currentUser, navigate]);

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    const result = await requestOtp(email);
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
      navigate('/dashboard');
    } else {
      setError(result.error ?? 'Invalid code.');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel ── */}
      <div className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative flex-col overflow-hidden">
        {/* Background photo */}
        <img
          src={BRAND_IMAGE}
          alt="Luxury residential property at dusk"
          crossOrigin="anonymous"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Deep gradient overlay — bottom-heavy for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--ink-deep)] via-[var(--ink-deep)]/50 to-[var(--ink-deep)]/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[var(--ink-deep)]/30" />

        {/* Brand content */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Logo mark */}
          <div className="flex items-center gap-3">
            <img src="/images/logo.png" alt="Martelli Buyers" className="h-11 w-11 rounded-full bg-white object-contain shadow-lg" />
            <div>
              <span className="text-sm font-bold tracking-wide" style={{ color: 'var(--paper-cream)' }}>
                Martelli Buyers CRM
              </span>
            </div>
          </div>

          {/* Main headline — pushed to bottom */}
          <div className="mt-auto space-y-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: 'hsl(var(--primary))' }}>
                Boutique Buyer Agency Platform
              </p>
              <h1 className="text-3xl xl:text-4xl font-bold leading-tight" style={{ color: 'var(--paper-cream)', fontFamily: 'var(--font-serif)' }}>
                Every great property<br />
                starts with the<br />
                right relationship.
              </h1>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: 'rgba(245, 240, 230, 0.65)' }}>
                The CRM built for boutique buyer's agencies who refuse to compromise on client experience.
              </p>
            </div>

            {/* Trust points */}
            <ul className="space-y-2.5">
              {TRUST_POINTS.map((point) => (
                <li key={point} className="flex items-start gap-2.5">
                  <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'hsl(var(--primary))' }} />
                  <span className="text-xs" style={{ color: 'rgba(245, 240, 230, 0.7)' }}>{point}</span>
                </li>
              ))}
            </ul>

            {/* Divider + tagline */}
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
        {/* Subtle background texture for right panel */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 60% 20%, hsl(var(--primary)) 0%, transparent 60%), radial-gradient(circle at 20% 80%, hsl(var(--accent)) 0%, transparent 50%)',
          }}
        />

        <div className="relative w-full max-w-[400px] space-y-8">
          {/* Mobile-only logo */}
          <div className="flex lg:hidden flex-col items-center gap-2">
            <img src="/images/logo.png" alt="Martelli Buyers" className="h-12 w-12 rounded-full object-contain shadow-lg" />
            <span className="text-sm font-bold text-foreground">Martelli Buyers CRM</span>
          </div>

          {/* Heading block */}
          <div>
            <h2
              className="text-[28px] font-bold tracking-tight text-foreground"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {step === 'email' ? 'Welcome back' : 'Check your email'}
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {step === 'email'
                ? 'Enter your email and we’ll send you a one-time sign-in code'
                : `We sent a 6-digit code to ${email}`}
            </p>
          </div>

          {/* Step 1 — request code */}
          {step === 'email' && (
            <form onSubmit={handleRequest} className="space-y-5">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className={cn(
                    'block text-[11px] font-semibold tracking-[0.08em] uppercase transition-colors',
                    focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setFocusedField('email')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="you@martellibuyers.com"
                  autoComplete="email"
                  className={cn(
                    'h-12 px-4 rounded-xl border-2 bg-card text-sm transition-all duration-200',
                    'placeholder:text-muted-foreground/40',
                    focusedField === 'email'
                      ? 'border-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]'
                      : 'border-border hover:border-border/80'
                  )}
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3">
                  <span className="mt-px h-4 w-4 shrink-0 rounded-full bg-destructive/15 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-destructive">!</span>
                  </span>
                  <p className="text-sm text-destructive leading-snug">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className={cn(
                  'w-full h-12 rounded-xl font-semibold text-sm tracking-wide',
                  'bg-primary text-primary-foreground',
                  'shadow-[0_4px_16px_hsl(var(--primary)/0.35)]',
                  'hover:shadow-[0_6px_24px_hsl(var(--primary)/0.45)] hover:-translate-y-px',
                  'transition-all duration-200',
                  'disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-none'
                )}
                disabled={!email.trim() || loading}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    Sending code…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    Send sign-in code
                    <Mail className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </form>
          )}

          {/* Step 2 — verify code */}
          {step === 'code' && (
            <form onSubmit={handleVerify} className="space-y-5">
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
                <div className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3">
                  <span className="mt-px h-4 w-4 shrink-0 rounded-full bg-destructive/15 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-destructive">!</span>
                  </span>
                  <p className="text-sm text-destructive leading-snug">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className={cn(
                  'w-full h-12 rounded-xl font-semibold text-sm tracking-wide',
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
                    Sign in
                    <ArrowRight className="h-4 w-4" />
                  </span>
                )}
              </Button>

              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Use a different email
              </button>
            </form>
          )}

          {/* Invite-only: no public signup. New users are added by an admin and
              receive an invite link by email. */}
          <p className="text-center text-[11px] text-muted-foreground/60">
            Access is invite-only. Need an account? Ask your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}