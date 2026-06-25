import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Eye, Loader2, Check, FileSignature, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useLeadsStore } from '@/stores/leadsStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AgreementEditor } from '@/components/agreement/AgreementEditor';
import { DocumentViewer } from '@/components/DocumentViewer';
import { getLeadAgreementContent, leadAgreementPdfPreviewPath, downloadLeadAgreementPdf } from '@/lib/documents';

/**
 * Full-screen WYSIWYG agreement builder for a LEAD. The buyer's agency agreement
 * is authored and signed during the lead phase; on Won it carries over to the
 * created journey (read-only). Mirrors the deal-stage editor. Signed = read-only.
 */
export default function LeadAgreementEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const leads = useLeadsStore((s) => s.leads);
  const updateLead = useLeadsStore((s) => s.updateLead);
  const lead = useMemo(() => leads.find((l) => l.id === id), [leads, id]);
  const leadName = lead ? `${lead.firstName} ${lead.lastName}`.trim() : '';

  const [body, setBody] = useState('');
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const bodyRef = useRef('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getLeadAgreementContent(id)
      .then((c) => {
        if (cancelled) return;
        setBody(c.bodyHtml);
        bodyRef.current = c.bodyHtml;
        setLocked(c.locked);
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Could not load the agreement.'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [id]);

  const persist = async () => {
    if (!id) return;
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    setSaving(true);
    try {
      await updateLead(id, { agreementBodyHtml: bodyRef.current });
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const onChange = (html: string) => {
    bodyRef.current = html;
    setDirty(true);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persist(); }, 1200);
  };

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  if (!id) return null;

  const status = saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/leads/${id}`)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Back
        </Button>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold leading-tight">
            <FileSignature className="h-5 w-5 text-primary" />
            Edit agreement
            {locked && <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" /> Signed — read only</Badge>}
          </h1>
          {leadName && <p className="text-sm text-muted-foreground">{leadName}</p>}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {!locked && (
            <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : !dirty && <Check className="h-3.5 w-3.5 text-success" />}
              {status}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
            <Eye className="mr-1.5 h-4 w-4" /> Preview PDF
          </Button>
          {!locked && (
            <Button size="sm" onClick={persist} disabled={saving || !dirty}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-xl bg-muted" />
          <div className="h-[60vh] animate-pulse rounded-xl bg-muted" />
        </div>
      ) : (
        <AgreementEditor value={body} onChange={onChange} editable={!locked} />
      )}

      {!locked && (
        <p className="text-xs text-muted-foreground">
          Merge fields (e.g. <span className="rounded bg-primary/10 px-1.5 py-0.5 font-medium text-primary">Client name</span>) are
          filled with the lead’s details when the PDF is generated. <Link to={`/leads/${id}`} className="underline">Edit lead details</Link> to change them.
        </p>
      )}

      {showPreview && (
        <DocumentViewer
          open={showPreview}
          onClose={() => setShowPreview(false)}
          title="Agreement preview"
          mimeType="application/pdf"
          previewPath={leadAgreementPdfPreviewPath(id)}
          canDownload
          onDownload={() => downloadLeadAgreementPdf(id)}
        />
      )}
    </div>
  );
}
