import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcw, Loader2, Trash2, Upload, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useCompanySettingsStore } from '@/stores/companySettingsStore';
import { ApiError, postBlob, triggerDownload } from '@/lib/api';
import { COMPANY_SETTINGS_DEFAULTS, type CompanySettings } from '@/types';

const MAX_LOGO_BYTES = 500 * 1024;
const HEX = /^#[0-9a-fA-F]{6}$/;

// Editable fields only (everything on CompanySettings except the server-managed
// id/createdAt/updatedAt). gstRate is kept as a string for smooth text editing.
type FormState = Omit<CompanySettings, 'id' | 'createdAt' | 'updatedAt' | 'gstRate'> & { gstRate: string };

const D = COMPANY_SETTINGS_DEFAULTS;

function blankForm(): FormState {
  return { ...D, gstRate: String(D.gstRate) };
}

function toForm(s: CompanySettings | null): FormState {
  if (!s) return blankForm();
  return {
    firmName: s.firmName, firmAddress: s.firmAddress, firmLicence: s.firmLicence,
    gstNumber: s.gstNumber, bankDetails: s.bankDetails,
    brandColor: s.brandColor, logoDataUrl: s.logoDataUrl,
    invoiceTitle: s.invoiceTitle, invoicePaymentTerms: s.invoicePaymentTerms,
    invoiceDefaultDescription: s.invoiceDefaultDescription, invoiceFooterText: s.invoiceFooterText,
    gstRate: String(s.gstRate),
  };
}

export function CompanySettingsSection() {
  const settings = useCompanySettingsStore((s) => s.settings);
  const loaded = useCompanySettingsStore((s) => s.loaded);
  const fetch = useCompanySettingsStore((s) => s.fetch);
  const save = useCompanySettingsStore((s) => s.save);

  const [form, setForm] = useState<FormState>(() => toForm(settings));
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  // Ensure the settings are loaded even if an admin deep-links here before boot.
  useEffect(() => { if (!loaded) fetch().catch(() => {}); }, [loaded, fetch]);
  // Re-sync the form whenever the stored settings load/change.
  useEffect(() => { setForm(toForm(settings)); }, [settings]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(settings));

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpe?g)$/.test(file.type)) {
      toast.error('Logo must be a PNG or JPEG image.');
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      toast.error('Logo must be smaller than 500 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('logoDataUrl', String(reader.result));
    reader.onerror = () => toast.error('Could not read that file.');
    reader.readAsDataURL(file);
  };

  const handlePreview = async () => {
    if (!HEX.test(form.brandColor)) { toast.error('Brand colour must be a #rrggbb hex value.'); return; }
    setPreviewing(true);
    try {
      const blob = await postBlob('/api/company-settings/preview.pdf', { ...form, gstRate: Number(form.gstRate) });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (!win) triggerDownload(blob, 'invoice-preview.pdf');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not generate preview.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!form.firmName.trim()) { toast.error('Company name is required.'); return; }
    if (!HEX.test(form.brandColor)) { toast.error('Brand colour must be a #rrggbb hex value.'); return; }
    const rate = Number(form.gstRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error('GST rate must be a number between 0 and 100.');
      return;
    }
    setSaving(true);
    try {
      await save({ ...form, gstRate: rate });
      toast.success('Company settings saved.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading company settings…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Company identity ─────────────────────────────────────────── */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Company identity</CardTitle>
          <CardDescription className="mt-1 text-sm">
            Appears on every generated PDF — invoices, agreements and DD reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <Field label="Company name" def={D.firmName} value={form.firmName} onReset={() => set('firmName', D.firmName)}>
            <Input value={form.firmName} maxLength={200} onChange={(e) => set('firmName', e.target.value)} placeholder="Your company name" />
          </Field>
          <Field label="Address" def={D.firmAddress} value={form.firmAddress} onReset={() => set('firmAddress', D.firmAddress)}>
            <Input value={form.firmAddress} maxLength={300} onChange={(e) => set('firmAddress', e.target.value)} placeholder="Street, suburb, city" />
          </Field>
          <Field label="Licence / registration line" def={D.firmLicence} value={form.firmLicence} onReset={() => set('firmLicence', D.firmLicence)}>
            <Input value={form.firmLicence} maxLength={200} onChange={(e) => set('firmLicence', e.target.value)} placeholder="e.g. Licensed REAA 2008" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="GST number (optional)">
              <Input value={form.gstNumber} maxLength={50} onChange={(e) => set('gstNumber', e.target.value)} placeholder="Shown on invoices" />
            </Field>
          </div>
          <Field label="Bank / payment details (optional)" hint="Shown in the Payment section of invoices.">
            <Textarea value={form.bankDetails} rows={2} maxLength={1000} onChange={(e) => set('bankDetails', e.target.value)} placeholder="e.g. ANZ 01-1234-0001234-00" />
          </Field>
        </CardContent>
      </Card>

      {/* ── Branding ─────────────────────────────────────────────────── */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Branding</CardTitle>
          <CardDescription className="mt-1 text-sm">Accent colour and logo used across documents.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 pt-5">
          <Field label="Accent colour" def={D.brandColor} value={form.brandColor} onReset={() => set('brandColor', D.brandColor)}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Accent colour"
                value={HEX.test(form.brandColor) ? form.brandColor : D.brandColor}
                onChange={(e) => set('brandColor', e.target.value)}
                className="h-9 w-12 cursor-pointer rounded border border-border bg-transparent p-0.5"
              />
              <Input value={form.brandColor} maxLength={7} onChange={(e) => set('brandColor', e.target.value)} placeholder="#1e6fb0" className="w-32 font-mono" />
            </div>
          </Field>

          <Field label="Logo" hint="PNG or JPEG, up to 500 KB. Replaces the company-name wordmark at the top of documents.">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-40 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-muted/40">
                {form.logoDataUrl
                  ? <img src={form.logoDataUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
                  : <span className="text-[11px] text-muted-foreground">No logo</span>}
              </div>
              <div className="flex flex-col gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
                  <Upload className="mr-1.5 h-3.5 w-3.5" /> {form.logoDataUrl ? 'Replace' : 'Upload'}
                </Button>
                {form.logoDataUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => set('logoDataUrl', '')} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
              <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoFile} />
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* ── Invoice template ─────────────────────────────────────────── */}
      <Card className="border-border/80 shadow-sm">
        <CardHeader className="border-b border-border/60 pb-4">
          <CardTitle className="text-base font-semibold">Invoice template</CardTitle>
          <CardDescription className="mt-1 text-sm">Text and tax rate applied to invoice PDFs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Document title" def={D.invoiceTitle} value={form.invoiceTitle} onReset={() => set('invoiceTitle', D.invoiceTitle)}>
              <Input value={form.invoiceTitle} maxLength={60} onChange={(e) => set('invoiceTitle', e.target.value)} placeholder="Tax Invoice" />
            </Field>
            <Field label="GST rate (%)" def={String(D.gstRate)} value={form.gstRate} onReset={() => set('gstRate', String(D.gstRate))} hint="Applied to new invoices.">
              <Input type="number" min={0} max={100} step="0.01" value={form.gstRate} onChange={(e) => set('gstRate', e.target.value)} className="w-32" />
            </Field>
          </div>
          <Field label="Payment terms" def={D.invoicePaymentTerms} value={form.invoicePaymentTerms} onReset={() => set('invoicePaymentTerms', D.invoicePaymentTerms)}>
            <Input value={form.invoicePaymentTerms} maxLength={200} onChange={(e) => set('invoicePaymentTerms', e.target.value)} placeholder="e.g. 7 working days from issue" />
          </Field>
          <Field label="Default line-item description" def={D.invoiceDefaultDescription} value={form.invoiceDefaultDescription} onReset={() => set('invoiceDefaultDescription', D.invoiceDefaultDescription)} hint="Used when an invoice has no description of its own.">
            <Input value={form.invoiceDefaultDescription} maxLength={200} onChange={(e) => set('invoiceDefaultDescription', e.target.value)} placeholder="Buyer agency services" />
          </Field>
          <Field label="Footer note" def={D.invoiceFooterText} value={form.invoiceFooterText} onReset={() => set('invoiceFooterText', D.invoiceFooterText)}>
            <Textarea value={form.invoiceFooterText} rows={3} maxLength={1000} onChange={(e) => set('invoiceFooterText', e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={handlePreview} disabled={previewing} className="mr-auto">
          {previewing ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating…</> : <><Eye className="mr-1.5 h-4 w-4" /> Preview invoice</>}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setForm(toForm(settings))} disabled={!dirty || saving}>
          Discard changes
        </Button>
        <Button type="button" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…</> : 'Save changes'}
        </Button>
      </div>
    </div>
  );
}

/** Labelled field row with an optional inline "reset to default" affordance. */
function Field({
  label, children, def, value, onReset, hint,
}: {
  label: string;
  children: React.ReactNode;
  def?: string;
  value?: string;
  onReset?: () => void;
  hint?: string;
}) {
  const showReset = def !== undefined && def !== '' && value !== undefined && value !== def && !!onReset;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</label>
        {showReset && (
          <button type="button" onClick={onReset} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground">
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
