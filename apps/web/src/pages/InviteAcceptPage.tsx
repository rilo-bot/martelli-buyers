import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export default function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const acceptInvite = useAuthStore((s) => s.acceptInvite);
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    // Single-use token — guard against StrictMode double-invoke.
    if (ran.current) return;
    ran.current = true;
    (async () => {
      const result = await acceptInvite(token ?? '');
      if (result.ok) navigate('/dashboard', { replace: true });
      else setError(result.error ?? 'This invite link is invalid or has expired.');
    })();
  }, [token, acceptInvite, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm text-center">
        <img src="/images/logo.png" alt="Martelli Buyers" className="mx-auto h-12 w-12 rounded-full object-contain shadow" />
        {!error ? (
          <>
            <div className="mx-auto mt-6 h-7 w-7 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
            <p className="mt-4 text-sm text-muted-foreground">Activating your account…</p>
          </>
        ) : (
          <>
            <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-foreground">Invite link not valid</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{error}</p>
            <Link
              to="/login"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all"
            >
              Go to sign in
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
