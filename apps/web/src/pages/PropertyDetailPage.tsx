import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useParams, Navigate, Link, useNavigate } from 'react-router-dom';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useCommentsStore } from '@/stores/commentsStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageTransition, Stagger, StaggerItem } from '@/components/motion';
import {
  ArrowLeft, Home, MapPin, DollarSign, Send, MessageSquare, BedDouble, Bath, Car,
  ExternalLink, Star, Upload, Trash2, ImageIcon, Film, Check, Loader2, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile, deleteUpload, isVideoUrl } from '@/lib/upload';
import { toast } from 'sonner';
import { PROPERTY_STATUS_ORDER, PROPERTY_STATUS_PILL } from '@/lib/statusStyles';
import { useDetailBreadcrumb } from '@/stores/breadcrumbStore';
import type { PropertyStatus } from '@/types';

const STATUS_OPTIONS = PROPERTY_STATUS_ORDER;
const STATUS_CONFIG = PROPERTY_STATUS_PILL;

type SaveState = 'idle' | 'saving' | 'saved';

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // ── All hooks run unconditionally, BEFORE any early return ───────────────
  const property = usePropertiesStore((s) => s.properties.find((p) => p.id === id));
  const updateProperty = usePropertiesStore((s) => s.updateProperty);
  const deleteProperty = usePropertiesStore((s) => s.deleteProperty);
  const loaded = usePropertiesStore((s) => s.loaded);
  const deal = useDealsStore((s) => s.deals.find((d) => d.id === property?.dealId));
  const comments = useCommentsStore((s) => s.comments);
  const addComment = useCommentsStore((s) => s.addComment);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [commentText, setCommentText] = useState('');
  const [clientVisible, setClientVisible] = useState(true);
  const [uploads, setUploads] = useState<{ id: string; name: string; percent: number }[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useDetailBreadcrumb(property ? (property.address || property.suburb || 'Property') : null);

  // Debounced note editing — local copy + auto-save, so we don't PATCH per keystroke.
  const [notes, setNotes] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const propertyComments = useMemo(
    () => comments.filter((c) => c.propertyId === id),
    [comments, id],
  );

  // Re-sync the local note copies whenever we land on a different property.
  useEffect(() => {
    setNotes(property?.notes ?? '');
    setClientNotes(property?.clientVisibleNotes ?? '');
    setSaveState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [property?.id]);

  // Clear pending timers on unmount.
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (savedTimer.current) clearTimeout(savedTimer.current);
  }, []);

  const scheduleSave = useCallback(
    (patch: { notes?: string; clientVisibleNotes?: string }) => {
      if (!id) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState('saving');
      saveTimer.current = setTimeout(async () => {
        try {
          await updateProperty(id, patch);
          setSaveState('saved');
          if (savedTimer.current) clearTimeout(savedTimer.current);
          savedTimer.current = setTimeout(() => setSaveState('idle'), 1600);
        } catch {
          setSaveState('idle');
          toast.error('Failed to save notes. Please try again.');
        }
      }, 600);
    },
    [id, updateProperty],
  );

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || !id) return;
      for (const file of Array.from(files)) {
        const tempId = crypto.randomUUID();
        setUploads((u) => [...u, { id: tempId, name: file.name, percent: 0 }]);
        try {
          const url = await uploadFile(file, {
            scope: 'property',
            scopeId: id,
            onProgress: (p) => setUploads((u) => u.map((x) => (x.id === tempId ? { ...x, percent: p } : x))),
          });
          // Read the freshest photos so sequential uploads don't clobber each other.
          const current = usePropertiesStore.getState().properties.find((p) => p.id === id)?.photos ?? [];
          await updateProperty(id, { photos: [...current, url] });
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Failed to upload ${file.name}.`);
        } finally {
          setUploads((u) => u.filter((x) => x.id !== tempId));
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [id, updateProperty],
  );

  const handleDeleteMedia = useCallback(
    async (url: string) => {
      if (!id) return;
      const current = usePropertiesStore.getState().properties.find((p) => p.id === id)?.photos ?? [];
      await updateProperty(id, { photos: current.filter((u) => u !== url) });
      deleteUpload(url).catch(() => {}); // best-effort object cleanup
      setLightbox((cur) => (cur === url ? null : cur));
    },
    [id, updateProperty],
  );

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !property || !id) return;
    addComment({
      dealId: property.dealId,
      propertyId: id,
      authorId: currentUser?.id ?? '',
      authorName: currentUser?.name ?? 'Staff',
      authorRole: 'staff',
      content: commentText.trim(),
      attachments: [],
      isClientVisible: clientVisible,
    });
    setCommentText('');
  };

  const handleDeleteProperty = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await deleteProperty(id);
      toast.success('Property deleted.');
      navigate(deal ? `/journeys/${deal.id}` : '/properties');
    } catch {
      setDeleting(false);
      toast.error('Failed to delete property.');
    }
  };

  // ── Early returns AFTER all hooks ────────────────────────────────────────
  if (!id) return <Navigate to="/properties" replace />;
  // While the store is still loading on a deep-link/refresh, show a skeleton
  // rather than redirecting away from a property that simply hasn't arrived yet.
  if (!property) {
    if (!loaded) return <DetailSkeleton />;
    return <Navigate to="/properties" replace />;
  }

  const photos = property.photos ?? [];

  return (
    <PageTransition className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="icon" className="-ml-2 mt-1 shrink-0">
          <Link to={deal ? `/journeys/${deal.id}` : '/properties'}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight truncate">{property.address}</h1>
            {property.isOffMarket && <Badge variant="secondary">Off-Market</Badge>}
          </div>
          <div className="flex items-center gap-x-4 gap-y-1 mt-1.5 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{property.suburb || '—'}</span>
            <span className="flex items-center gap-1.5"><BedDouble className="h-3.5 w-3.5" />{property.bedrooms} bd</span>
            <span className="flex items-center gap-1.5"><Bath className="h-3.5 w-3.5" />{property.bathrooms} ba</span>
            <span className="flex items-center gap-1.5"><Car className="h-3.5 w-3.5" />{property.carparks} car</span>
            {property.priceGuide && <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />{property.priceGuide}</span>}
          </div>
          {deal && (
            <Link to={`/journeys/${deal.id}`} className="text-xs text-primary hover:underline mt-1.5 inline-block">
              Part of journey: {deal.clientName}
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Select
            value={property.status}
            onChange={(e) => updateProperty(id, { status: e.target.value as PropertyStatus })}
            className={cn('w-36 text-sm font-semibold border capitalize', STATUS_CONFIG[property.status])}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s} className="bg-background text-foreground font-normal">{s.replace('_', ' ')}</option>
            ))}
          </Select>
          <Button variant="outline" size="icon" onClick={() => setConfirmDelete(true)} aria-label="Delete property"
            className="text-muted-foreground hover:text-destructive hover:border-destructive/40">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="media">Media ({photos.length})</TabsTrigger>
          <TabsTrigger value="comments">Comments ({propertyComments.length})</TabsTrigger>
          <TabsTrigger value="visibility">Client Visibility</TabsTrigger>
        </TabsList>

        {/* DETAILS */}
        <TabsContent value="details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Property Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {[
                    { label: 'Price Guide', value: property.priceGuide || 'TBC' },
                    { label: 'Type', value: property.propertyType || '—' },
                    { label: 'Bedrooms', value: property.bedrooms },
                    { label: 'Bathrooms', value: property.bathrooms },
                    { label: 'Carparks', value: property.carparks },
                    ...(property.landSize > 0 ? [{ label: 'Land Size', value: `${property.landSize}m²` }] : []),
                  ].map((f) => (
                    <div key={f.label}>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">{f.label}</p>
                      <p className="font-semibold">{f.value}</p>
                    </div>
                  ))}
                </div>
                {property.sourceAgentName && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Source Agent</p>
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium">{property.sourceAgentName}</span>
                    </div>
                  </div>
                )}
                {property.listingUrl && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={property.listingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />View Listing
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">Notes</CardTitle>
                <SaveIndicator state={saveState} />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="internalNotes">Internal notes (staff only)</Label>
                  <Textarea
                    id="internalNotes"
                    value={notes}
                    onChange={(e) => { setNotes(e.target.value); scheduleSave({ notes: e.target.value }); }}
                    rows={4}
                    placeholder="Internal observations, agent feedback, inspection notes..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientNotes">Client-visible notes</Label>
                  <Textarea
                    id="clientNotes"
                    value={clientNotes}
                    onChange={(e) => { setClientNotes(e.target.value); scheduleSave({ clientVisibleNotes: e.target.value }); }}
                    rows={4}
                    placeholder="Notes visible to the client in their portal..."
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* MEDIA */}
        <TabsContent value="media">
          <div className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
              className={cn(
                'flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-10 cursor-pointer text-center transition-colors',
                dragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/30',
              )}
            >
              <Upload className={cn('h-7 w-7 mb-2 transition-colors', dragActive ? 'text-primary' : 'text-muted-foreground/50')} />
              <p className="text-sm font-medium">{dragActive ? 'Drop to upload' : 'Click to upload or drag & drop'}</p>
              <p className="text-xs text-muted-foreground mt-1">Photos (≤15MB) and videos (≤200MB)</p>
            </div>

            {/* In-flight uploads */}
            {uploads.length > 0 && (
              <div className="space-y-2">
                {uploads.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 text-sm">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary shrink-0" />
                    <span className="truncate flex-1">{u.name}</span>
                    <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary transition-all" style={{ width: `${u.percent}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums w-9 text-right">{u.percent}%</span>
                  </div>
                ))}
              </div>
            )}

            {/* Gallery */}
            {photos.length === 0 && uploads.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="No media yet"
                description="Upload photos or videos of this property to share with your client."
                compact
              />
            ) : (
              <Stagger className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" step={0.03}>
                {photos.map((url) => (
                  <StaggerItem key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted">
                    {isVideoUrl(url) ? (
                      <video src={url} controls className="h-full w-full object-cover" />
                    ) : (
                      <button type="button" onClick={() => setLightbox(url)} className="h-full w-full">
                        <img src={url} alt="Property media" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      </button>
                    )}
                    {isVideoUrl(url) && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white flex items-center gap-1 pointer-events-none">
                        <Film className="h-3 w-3" /> Video
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteMedia(url)}
                      className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                      aria-label="Delete media"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        </TabsContent>

        {/* COMMENTS */}
        <TabsContent value="comments">
          <div className="space-y-4">
            <form onSubmit={handleAddComment} className="space-y-2">
              <Textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a property comment or inspection note..."
                rows={3}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clientVisible}
                    onChange={(e) => setClientVisible(e.target.checked)}
                    className="rounded"
                  />
                  Visible to client
                </label>
                <Button type="submit" size="sm" disabled={!commentText.trim()}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />Post Comment
                </Button>
              </div>
            </form>

            {propertyComments.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No comments yet"
                description="Post inspection notes or updates for this property."
                compact
              />
            ) : (
              <Stagger className="space-y-3" step={0.04}>
                {propertyComments.map((c) => (
                  <StaggerItem key={c.id}>
                    <Card className="border-border/60">
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                            {(c.authorName[0] ?? '?').toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium">{c.authorName}</p>
                              <p className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString('en-NZ')}</p>
                              {c.isClientVisible ? (
                                <Badge variant="secondary" className="text-xs">Client visible</Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">Internal</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                ))}
              </Stagger>
            )}
          </div>
        </TabsContent>

        {/* VISIBILITY */}
        <TabsContent value="visibility">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client Portal Visibility</CardTitle>
              <CardDescription>Control what clients see in their portal for this property.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-border/60">
                <div>
                  <p className="text-sm font-medium">Show in client portal</p>
                  <p className="text-xs text-muted-foreground">Clients can see this property in their engagement view</p>
                </div>
                <button
                  type="button"
                  onClick={() => updateProperty(id, { isClientVisible: !property.isClientVisible })}
                  role="switch"
                  aria-checked={property.isClientVisible}
                  className={cn('relative inline-flex h-6 w-11 items-center rounded-full transition-colors', property.isClientVisible ? 'bg-primary' : 'bg-muted')}
                >
                  <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', property.isClientVisible ? 'translate-x-6' : 'translate-x-1')} />
                </button>
              </div>
              <div className="py-2">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When enabled, the client can view this property listing, client-visible notes, and add their own comments.
                  Internal notes and agent source details remain hidden.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <img src={lightbox} alt="Property media" className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delete this property?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This permanently removes <span className="font-medium text-foreground">{property.address}</span>, its uploaded media,
            comments, and any due-diligence records. This can't be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost" disabled={deleting}>Cancel</Button></DialogClose>
            <Button type="button" variant="destructive" onClick={handleDeleteProperty} disabled={deleting}>
              {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}

/** Subtle "Saving… / Saved" indicator beside the Notes card title. */
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  return (
    <span className={cn('flex items-center gap-1.5 text-xs font-medium', state === 'saved' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
      {state === 'saving' ? (
        <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
      ) : (
        <><Check className="h-3 w-3" /> Saved</>
      )}
    </span>
  );
}

/** Loading placeholder shown on a deep-link while the store hydrates. */
function DetailSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-start gap-4">
        <div className="h-9 w-9 rounded-md bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-8 w-64 rounded-md bg-muted" />
          <div className="h-4 w-80 rounded-md bg-muted" />
        </div>
        <div className="h-9 w-36 rounded-md bg-muted" />
      </div>
      <div className="h-10 w-full max-w-md rounded-md bg-muted" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-64 rounded-xl bg-muted" />
        <div className="h-64 rounded-xl bg-muted" />
      </div>
    </div>
  );
}
