import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiUrl, request, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, FileSignature, AlertCircle } from 'lucide-react';

interface SignInfo {
  clientName: string;
  propertyType: string;
  budget: number;
  fee: number;
  feeType: 'fixed' | 'percentage';
  agreementStatus: 'pending' | 'sent' | 'signed';
  signerName: string;
  signedAt: string;
}

export default function SignAgreementPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signerName, setSignerName] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedName, setSignedName] = useState('');

  useEffect(() => {
    if (!token) return;
    request<SignInfo>('GET', `/api/sign/${token}`)
      .then((data) => {
        setInfo(data);
        if (data.agreementStatus === 'signed') setSignedName(data.signerName);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this agreement.'))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !signerName.trim() || !agree) return;
    setSubmitting(true);
    try {
      const res = await request<{ ok: boolean; signerName: string }>('POST', `/api/sign/${token}`, {
        signerName: signerName.trim(),
        agree: true,
      });
      setSignedName(res.signerName || signerName.trim());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record signature.');
    } finally {
      setSubmitting(false);
    }
  };

  const feeLabel = info
    ? info.feeType === 'percentage'
      ? `${info.fee}% + GST`
      : `$${info.fee.toLocaleString()} + GST`
    : '';

  const signed = signedName || info?.agreementStatus === 'signed';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4">
          <img src="/images/logo.png" alt="Martelli" className="h-9 w-9 rounded-full object-contain" />
          <div>
            <p className="text-sm font-bold leading-tight">Martelli Buyers Agents</p>
            <p className="text-xs text-muted-foreground">Buyer’s Agency Agreement</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {loading && <p className="text-sm text-muted-foreground">Loading agreement…</p>}

        {!loading && error && !info && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="h-10 w-10 text-destructive mb-3" />
            <h1 className="text-lg font-semibold">Link unavailable</h1>
            <p className="mt-1 text-sm text-muted-foreground max-w-sm">{error}</p>
          </div>
        )}

        {info && (
          <div className="space-y-6">
            {signed ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 py-12 text-center dark:border-emerald-900/30 dark:bg-emerald-900/10">
                <CheckCircle className="h-12 w-12 text-emerald-600 mb-3" />
                <h1 className="text-xl font-bold">Agreement signed</h1>
                <p className="mt-1.5 text-sm text-emerald-800 dark:text-emerald-300">
                  Thank you, <span className="font-semibold">{signedName || info.signerName}</span>. Your agreement has been recorded.
                </p>
                <p className="mt-3 text-xs text-muted-foreground">A copy was emailed to you. You may close this window.</p>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold tracking-tight">Review &amp; sign your agreement</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {info.clientName}, please review the agreement below before signing.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                  <span><span className="text-muted-foreground">Property:</span> {info.propertyType || 'As discussed'}</span>
                  <span><span className="text-muted-foreground">Budget:</span> ${info.budget.toLocaleString()}</span>
                  <span><span className="text-muted-foreground">Fee:</span> {feeLabel}</span>
                </div>
              </div>
            )}

            {/* Agreement document */}
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <iframe
                title="Agency Agreement"
                src={apiUrl(`/api/sign/${token}/agreement.pdf`)}
                className="h-[60vh] w-full"
              />
            </div>

            {!signed && (
              <form onSubmit={handleSign} className="space-y-4 rounded-xl border border-border bg-card p-5">
                <div className="space-y-1.5">
                  <Label htmlFor="signerName">Type your full legal name to sign *</Label>
                  <Input
                    id="signerName"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    autoComplete="name"
                  />
                </div>
                <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <span className="text-muted-foreground leading-relaxed">
                    I have read and agree to the terms of this Buyer’s Agency Agreement. I understand I may seek
                    independent legal advice, and that typing my name constitutes my electronic signature.
                  </span>
                </label>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button type="submit" disabled={!signerName.trim() || !agree || submitting} className="w-full sm:w-auto">
                  <FileSignature className="mr-2 h-4 w-4" />
                  {submitting ? 'Signing…' : 'Sign agreement'}
                </Button>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
