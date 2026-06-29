import { useEffect, useState } from 'react';
import { Share2, FileText, Image as ImageIcon, Eye, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { DocumentViewer } from '@/components/DocumentViewer';
import { categoryLabel, formatBytes, fileKind } from '@/components/documents/entityMeta';
import { useDocumentsStore } from '@/stores/documentsStore';
import { useUsersStore } from '@/stores/usersStore';
import type { Document } from '@/types';

/**
 * Documents an admin has shared with the current user. Preview-only — there is
 * no download affordance (the server denies a save URL to non-owners anyway).
 */
export default function SharedWithMePage() {
  const sharedWithMe = useDocumentsStore((s) => s.sharedWithMe);
  const fetchSharedWithMe = useDocumentsStore((s) => s.fetchSharedWithMe);
  const previewPath = useDocumentsStore((s) => s.previewPath);
  const nameFor = useUsersStore((s) => s.nameFor);

  const [loading, setLoading] = useState(sharedWithMe.length === 0);
  const [viewDoc, setViewDoc] = useState<Document | null>(null);

  // Always refresh on mount — a doc may have been shared since bootstrap.
  useEffect(() => {
    let cancelled = false;
    fetchSharedWithMe()
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchSharedWithMe]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shared with me"
        subtitle="Documents teammates have shared with you. You can preview these — downloading isn’t available."
      />

      {loading && sharedWithMe.length === 0 ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : sharedWithMe.length === 0 ? (
        <EmptyState
          icon={Share2}
          title="Nothing shared with you yet"
          description="When a teammate shares a document with you, it’ll appear here for preview."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Category</th>
                  <th className="px-4 py-2.5 font-medium">Shared by</th>
                  <th className="px-4 py-2.5 font-medium">Size</th>
                  <th className="px-4 py-2.5 font-medium">Added</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {sharedWithMe.map((doc) => {
                  const Icon = fileKind(doc.mimeType) === 'image' ? ImageIcon : FileText;
                  const owner = nameFor(doc.uploadedBy);
                  return (
                    <tr key={doc.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <p className="min-w-0 truncate font-medium">{doc.name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {doc.category
                          ? <Badge variant="secondary" className="font-normal">{categoryLabel(doc.category)}</Badge>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{owner || '—'}</td>
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{formatBytes(doc.size)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {new Date(doc.createdAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary" onClick={() => setViewDoc(doc)} title="Preview">
                            <Eye className="h-4 w-4" />
                          </Button>
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

      {viewDoc && (
        <DocumentViewer
          open={!!viewDoc}
          onClose={() => setViewDoc(null)}
          title={viewDoc.name}
          mimeType={viewDoc.mimeType}
          previewPath={previewPath(viewDoc.id)}
          canDownload={false}
        />
      )}
    </div>
  );
}
