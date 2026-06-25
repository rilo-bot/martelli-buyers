import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Paperclip, UploadCloud, FileText, Eye, Pencil, Trash2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { DocumentViewer } from '@/components/DocumentViewer';
import { useDocumentsStore } from '@/stores/documentsStore';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { usePermissions } from '@/lib/permissions';
import { canDownloadDoc } from '@/lib/docAccess';
import type { Document, DocumentCategory, DocumentEntityType } from '@/types';
import { DocumentUploadDialog, DocumentEditDialog, type AttachLink } from './DocumentDialogs';
import { categoryLabel, formatBytes } from './entityMeta';

/**
 * Reusable "Documents" panel for any module's detail view. Lists the documents
 * attached to one entity and lets users upload, preview, edit metadata, download
 * (owner/admin) and delete — all RBAC-gated. Replaces the per-page copies that
 * used to be duplicated across detail pages.
 */
export function EntityDocuments({
  entityType, entityId, dealId, defaultCategory = '', title = 'Documents', className,
}: {
  entityType: DocumentEntityType;
  entityId: string;
  /** Denormalised Buyer Journey id when this entity belongs to one. */
  dealId?: string;
  defaultCategory?: DocumentCategory | '';
  title?: string;
  className?: string;
}) {
  const documents = useDocumentsStore((s) => s.documents);
  const deleteDocument = useDocumentsStore((s) => s.deleteDocument);
  const previewPath = useDocumentsStore((s) => s.previewPath);
  const triggerFileDownload = useDocumentsStore((s) => s.triggerFileDownload);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasS3 = useConfigStore((s) => s.hasS3);
  const { can } = usePermissions();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canUpload = hasS3 && can('documents:create');
  const canEdit = can('documents:edit');
  const canDelete = can('documents:delete');

  const docs = useMemo(
    () => documents
      .filter((d) => d.entityType === entityType && d.entityId === entityId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [documents, entityType, entityId],
  );

  const lockedTarget: AttachLink & { dealId?: string } = {
    entityType, entityId,
    dealId: dealId ?? (entityType === 'deal' ? entityId : ''),
  };

  const handleDownload = async (doc: Document) => {
    try {
      await triggerFileDownload(doc.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not download document.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDocument(deleteTarget.id);
      setDeleteTarget(null);
      toast.success('Document removed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove document.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="h-4 w-4 text-primary" />
            {title}
            <span className="text-sm font-normal text-muted-foreground">({docs.length})</span>
          </CardTitle>
          {canUpload && (
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setUploadOpen(true)}>
              <UploadCloud className="mr-1.5 h-3.5 w-3.5" /> Upload
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {!hasS3 ? (
          <p className="text-xs text-muted-foreground">File uploads aren’t configured on the server.</p>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-primary/30 bg-primary/8">
              <UploadCloud className="h-6 w-6 text-primary/40" />
            </div>
            <p className="text-sm font-medium">No documents yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {canUpload ? 'Upload files to attach them here.' : 'Documents attached here will appear in this list.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border/60">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{doc.name}</p>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {doc.category && <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">{categoryLabel(doc.category)}</Badge>}
                    {formatBytes(doc.size)} · {new Date(doc.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" onClick={() => setViewDoc(doc)} title="Preview">
                  <Eye className="h-4 w-4" />
                </Button>
                {canEdit && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" onClick={() => setEditDoc(doc)} title="Edit details">
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {canDelete && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(doc)} title="Remove">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      {uploadOpen && (
        <DocumentUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} lockedTarget={lockedTarget} defaultCategory={defaultCategory} />
      )}
      {editDoc && (
        <DocumentEditDialog open={!!editDoc} onClose={() => setEditDoc(null)} doc={editDoc} />
      )}
      {viewDoc && (
        <DocumentViewer
          open={!!viewDoc}
          onClose={() => setViewDoc(null)}
          title={viewDoc.name}
          mimeType={viewDoc.mimeType}
          previewPath={previewPath(viewDoc.id)}
          canDownload={canDownloadDoc(viewDoc.uploadedBy, currentUser)}
          onDownload={() => handleDownload(viewDoc)}
        />
      )}

      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o && !deleting) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Remove document</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong className="text-foreground">{deleteTarget?.name}</strong>? This deletes the file permanently and cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button variant="ghost" disabled={deleting}>Cancel</Button></DialogClose>
            <Button variant="destructive" disabled={deleting} onClick={handleDelete}>
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Removing…</> : 'Remove document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
