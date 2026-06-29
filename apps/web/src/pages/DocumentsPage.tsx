import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FolderArchive, UploadCloud, Search, FileText, Image as ImageIcon, Eye, Pencil, Trash2, Loader2, ExternalLink, Share2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { DocumentViewer } from '@/components/DocumentViewer';
import { DocumentUploadDialog, DocumentEditDialog } from '@/components/documents/DocumentDialogs';
import { DocumentShareDialog } from '@/components/documents/DocumentShareDialog';
import {
  CATEGORY_OPTIONS, ATTACHABLE_TYPES, ENTITY_TYPE_LABELS, categoryLabel, formatBytes, fileKind,
  useEntityCatalog, resolveAttachment,
} from '@/components/documents/entityMeta';
import { useDocumentsStore } from '@/stores/documentsStore';
import { useAuthStore } from '@/stores/authStore';
import { useConfigStore } from '@/stores/configStore';
import { usePermissions } from '@/lib/permissions';
import { canDownloadDoc, canShareDoc } from '@/lib/docAccess';
import type { Document } from '@/types';

type KindFilter = 'all' | 'image' | 'pdf' | 'doc';
type AttachFilter = 'all' | 'unlinked' | string;

export default function DocumentsPage() {
  const documents = useDocumentsStore((s) => s.documents);
  const loading = useDocumentsStore((s) => s.loading);
  const deleteDocument = useDocumentsStore((s) => s.deleteDocument);
  const previewPath = useDocumentsStore((s) => s.previewPath);
  const triggerFileDownload = useDocumentsStore((s) => s.triggerFileDownload);
  const currentUser = useAuthStore((s) => s.currentUser);
  const hasS3 = useConfigStore((s) => s.hasS3);
  const { can } = usePermissions();
  const catalog = useEntityCatalog();

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [attach, setAttach] = useState<AttachFilter>('all');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editDoc, setEditDoc] = useState<Document | null>(null);
  const [shareDoc, setShareDoc] = useState<Document | null>(null);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Document | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canUpload = hasS3 && can('documents:create');
  const canEdit = can('documents:edit');
  const canDelete = can('documents:delete');
  const canShare = canShareDoc(currentUser);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents
      .filter((d) => {
        if (q && !(`${d.name} ${d.description} ${d.tags.join(' ')}`.toLowerCase().includes(q))) return false;
        if (category && d.category !== category) return false;
        if (kind !== 'all' && fileKind(d.mimeType) !== kind) return false;
        if (attach === 'unlinked' && d.entityType) return false;
        if (attach !== 'all' && attach !== 'unlinked' && d.entityType !== attach) return false;
        return true;
      })
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [documents, search, category, kind, attach]);

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
    <div className="space-y-5">
      <PageHeader
        title="Documents"
        subtitle="Every uploaded file in one place — attach any document or image to clients, journeys, properties and more."
        actions={canUpload && (
          <Button onClick={() => setUploadOpen(true)}>
            <UploadCloud className="mr-1.5 h-4 w-4" /> Upload
          </Button>
        )}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, tag or note…" className="pl-9" />
        </div>
        <Select containerClassName="w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </Select>
        <Select containerClassName="w-auto" value={kind} onChange={(e) => setKind(e.target.value as KindFilter)}>
          <option value="all">All types</option>
          <option value="image">Images</option>
          <option value="pdf">PDFs</option>
          <option value="doc">Documents</option>
        </Select>
        <Select containerClassName="w-auto" value={attach} onChange={(e) => setAttach(e.target.value)}>
          <option value="all">Anywhere</option>
          <option value="unlinked">Not attached</option>
          {ATTACHABLE_TYPES.map((t) => <option key={t} value={t}>{ENTITY_TYPE_LABELS[t]}</option>)}
        </Select>
      </div>

      {!hasS3 ? (
        <EmptyState icon={FolderArchive} title="File storage isn’t configured" description="Uploads are unavailable until S3 storage is set up on the server." />
      ) : loading && documents.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FolderArchive}
          title={documents.length === 0 ? 'No documents yet' : 'No matching documents'}
          description={documents.length === 0 ? 'Upload files and attach them to any record across the app.' : 'Try clearing a filter or search term.'}
          action={canUpload && documents.length === 0 ? <Button onClick={() => setUploadOpen(true)}><UploadCloud className="mr-1.5 h-4 w-4" /> Upload a document</Button> : undefined}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Attached to</th>
                  <th className="px-4 py-2.5 font-medium">Size</th>
                  <th className="px-4 py-2.5 font-medium">Added</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc) => {
                  const link = resolveAttachment(catalog, doc.entityType, doc.entityId);
                  const Icon = fileKind(doc.mimeType) === 'image' ? ImageIcon : FileText;
                  return (
                    <tr key={doc.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{doc.name}</p>
                            {doc.tags.length > 0 && (
                              <p className="truncate text-xs text-muted-foreground">{doc.tags.join(', ')}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {doc.category
                          ? <Badge variant="secondary" className="font-normal">{categoryLabel(doc.category)}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {link ? (
                          link.to ? (
                            <Link to={link.to} className="inline-flex items-center gap-1 text-primary hover:underline">
                              <span className="text-xs text-muted-foreground">{link.typeLabel}:</span> {link.name}
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span><span className="text-xs text-muted-foreground">{link.typeLabel}:</span> {link.name}</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">Not attached</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatBytes(doc.size)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" onClick={() => setViewDoc(doc)} title="Preview">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canShare && (
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" onClick={() => setShareDoc(doc)} title="Share (preview-only)">
                              <Share2 className="h-4 w-4" />
                            </Button>
                          )}
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
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {uploadOpen && <DocumentUploadDialog open={uploadOpen} onClose={() => setUploadOpen(false)} />}
      {editDoc && <DocumentEditDialog open={!!editDoc} onClose={() => setEditDoc(null)} doc={editDoc} />}
      {shareDoc && <DocumentShareDialog open={!!shareDoc} onClose={() => setShareDoc(null)} doc={shareDoc} />}
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
    </div>
  );
}
