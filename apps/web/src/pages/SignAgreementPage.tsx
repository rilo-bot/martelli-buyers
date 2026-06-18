import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import SignatureCanvas from 'react-signature-canvas';
import { apiUrl, request, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, FileSignature, AlertCircle, Pen, Type, Eraser, Undo2, ExternalLink } from 'lucide-react';

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

type SignMode = 'draw' | 'type';

export default function SignAgreementPage() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<SignInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signerName, setSignerName] = useState('');
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signedName, setSignedName] = useState('');
  const [mode, setMode] = useState<SignMode>('draw');
  const [hasDrawing, setHasDrawing] = useState(false);

  const padRef = useRef<SignatureCanvas | null>(null);
  const padWrapRef = useRef<HTMLDivElement | null>(null);

  const signed = signedName || info?.agreementStatus === 'signed';

  // react-signature-canvas leaves the canvas backing store at its default
  // 300x150 while CSS stretches it, which offsets the pen. Size the backing
  // store to the rendered box (clears any in-progress drawing on resize).
  useEffect(() => {
    if (signed || mode !== 'draw') return;
    const resize = () => {
      const pad = padRef.current;
      const wrap = padWrapRef.current;
      if (!pad || !wrap) return;
      const canvas = pad.getCanvas();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = wrap.clientWidth * ratio;
      canvas.height = wrap.clientHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      setHasDrawing(false);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [signed, mode, info]);

  useEffect(() => {
    if (!token) return;
    request<SignInfo>('GET', `/api/sign/${token}`)
      .then((data) => {
        setInfo(data);
        if (data.clientName) setSignerName(data.clientName);
        if (data.agreementStatus === 'signed') setSignedName(data.signerName);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load this agreement.'))
      .finally(() => setLoading(false));
  }, [token]);

  const clearPad = () => {
    padRef.current?.clear();
    setHasDrawing(false);
  };

  // Undo the last pen stroke by replaying all strokes except the most recent.
  const undoStroke = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    if (!data.length) return;
    data.pop();
    pad.fromData(data);
    setHasDrawing(data.length > 0);
  };

  const drawingReady = mode === 'draw' ? hasDrawing : true;
  const canSubmit = !!signerName.trim() && agree && drawingReady && !submitting;

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canSubmit) return;

    let signatureImage: string | undefined;
    if (mode === 'draw') {
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) {
        setError('Please draw your signature, or switch to typing your name.');
        return;
      }
      signatureImage = pad.getCanvas().toDataURL('image/png');
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await request<{ ok: boolean; signerName: string }>('POST', `/api/sign/${token}`, {
        signerName: signerName.trim(),
        agree: true,
        ...(signatureImage ? { signatureImage } : {}),
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

  // `#toolbar=0` hides the browser's native PDF chrome so the document reads as
  // a clean preview rather than a developer tool.
  const pdfSrc = `${apiUrl(`/api/sign/${token}/agreement.pdf`)}#toolbar=0&navpanes=0&view=FitH`;

  return (
    <div className="min-h-screen bg-muted/30 text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight">Martelli Buyers Agents</p>
            <p className="truncate text-xs text-muted-foreground">Buyer’s Agency Agreement</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        {loading && <p className="text-sm text-muted-foreground">Loading agreement…</p>}

        {!loading && error && !info && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <AlertCircle className="mb-3 h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Link unavailable</h1>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {info && signed && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 py-14 text-center dark:border-emerald-900/30 dark:bg-emerald-900/10">
            <CheckCircle className="mb-3 h-12 w-12 text-emerald-600" />
            <h1 className="text-xl font-bold">Agreement signed</h1>
            <p className="mt-1.5 text-sm text-emerald-800 dark:text-emerald-300">
              Thank you, <span className="font-semibold">{signedName || info.signerName}</span>. Your agreement has been recorded.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">A copy was emailed to you. You may close this window.</p>
            <a
              href={apiUrl(`/api/sign/${token}/agreement.pdf`)}
              target="_blank"
              rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" /> View signed agreement
            </a>
          </div>
        )}

        {info && !signed && (
          <div className="space-y-5">
            {/* Intro */}
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Review &amp; sign your agreement</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {info.clientName}, please review the agreement, then sign at the bottom.
              </p>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-center">
              <div className="bg-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Property</p>
                <p className="mt-0.5 text-sm font-medium">{info.propertyType || 'As discussed'}</p>
              </div>
              <div className="bg-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Budget</p>
                <p className="mt-0.5 text-sm font-medium">${info.budget.toLocaleString()}</p>
              </div>
              <div className="bg-card px-3 py-2.5">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Fee</p>
                <p className="mt-0.5 text-sm font-medium">{feeLabel}</p>
              </div>
            </div>

            {/* Step 1 — Review */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={1} />
                <h2 className="text-sm font-semibold">Review the agreement</h2>
                <a
                  href={apiUrl(`/api/sign/${token}/agreement.pdf`)}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open full
                </a>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <iframe
                  title="Agency Agreement"
                  src={pdfSrc}
                  className="h-[58vh] w-full border-0"
                />
              </div>
            </section>

            {/* Step 2 — Sign */}
            <section>
              <div className="mb-2 flex items-center gap-2">
                <StepBadge n={2} />
                <h2 className="text-sm font-semibold">Add your signature</h2>
              </div>

              <form onSubmit={handleSign} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
                {/* Mode toggle */}
                <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
                  <ModeTab active={mode === 'draw'} onClick={() => setMode('draw')} icon={<Pen className="h-4 w-4" />} label="Draw" />
                  <ModeTab active={mode === 'type'} onClick={() => setMode('type')} icon={<Type className="h-4 w-4" />} label="Type" />
                </div>

                {mode === 'draw' ? (
                  <div className="space-y-1.5">
                    <div ref={padWrapRef} className="relative h-40 rounded-lg border border-dashed border-border bg-background">
                      <SignatureCanvas
                        ref={padRef}
                        penColor="#111827"
                        onEnd={() => setHasDrawing(true)}
                        canvasProps={{ className: 'h-40 w-full touch-none rounded-lg' }}
                      />
                      {!hasDrawing && (
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                          Sign here with your mouse or finger
                        </span>
                      )}
                      <div className="absolute right-2 top-2 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={undoStroke}
                          disabled={!hasDrawing}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Undo2 className="h-3.5 w-3.5" /> Undo
                        </button>
                        <button
                          type="button"
                          onClick={clearPad}
                          disabled={!hasDrawing}
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Eraser className="h-3.5 w-3.5" /> Clear
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <div className="flex min-h-[5rem] items-center rounded-lg border border-dashed border-border bg-background px-4">
                      <span
                        className="text-3xl text-foreground"
                        style={{ fontFamily: '"Segoe Script", "Brush Script MT", cursive' }}
                      >
                        {signerName.trim() || 'Your signature'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">Your typed name will appear as your signature.</p>
                  </div>
                )}

                {/* Legal name */}
                <div className="space-y-1.5">
                  <Label htmlFor="signerName">Full legal name *</Label>
                  <Input
                    id="signerName"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="e.g. Jane Smith"
                    autoComplete="name"
                  />
                </div>

                {/* Consent */}
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={agree}
                    onChange={(e) => setAgree(e.target.checked)}
                    className="mt-0.5 rounded"
                  />
                  <span className="leading-relaxed text-muted-foreground">
                    I have read and agree to the terms of this Buyer’s Agency Agreement. I understand I may seek
                    independent legal advice, and that my signature above constitutes my electronic signature.
                  </span>
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button type="submit" disabled={!canSubmit} className="w-full sm:w-auto">
                  <FileSignature className="mr-2 h-4 w-4" />
                  {submitting ? 'Signing…' : 'Sign agreement'}
                </Button>
                {!canSubmit && !submitting && (
                  <p className="text-xs text-muted-foreground">
                    {mode === 'draw' && !hasDrawing
                      ? 'Draw your signature, enter your name, and tick the box to enable signing.'
                      : 'Enter your name and tick the box to enable signing.'}
                  </p>
                )}
              </form>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
      {n}
    </span>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${
        active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
