import { useState, useMemo, useRef } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { usePropertiesStore } from '@/stores/propertiesStore';
import { useDealsStore } from '@/stores/dealsStore';
import { useCommentsStore } from '@/stores/commentsStore';
import { useAuthStore } from '@/stores/authStore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  ArrowLeft, Home, MapPin, DollarSign, Send, MessageSquare,
  ExternalLink, Star, CheckCircle, Upload, Trash2, ImageIcon, Film
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile, deleteUpload, isVideoUrl } from '@/lib/upload';
import { toast } from 'sonner';
import type { PropertyStatus } from '@/types';

const STATUS_OPTIONS: PropertyStatus[] = ['active', 'shortlisted', 'inspected', 'passed', 'offer_made', 'purchased'];

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  if (!id) return <Navigate to="/properties" replace />;

  const property = usePropertiesStore((s) => s.properties.find((p) => p.id === id));
  const updateProperty = usePropertiesStore((s) => s.updateProperty);
  const deal = useDealsStore((s) => s.deals.find((d) => d.id === property?.dealId));
  const comments = useCommentsStore((s) => s.comments);
  const addComment = useCommentsStore((s) => s.addComment);
  const currentUser = useAuthStore((s) => s.currentUser);

  const [commentText, setCommentText] = useState('');
  const [clientVisible, setClientVisible] = useState(true);

  if (!property) return <Navigate to="/properties" replace />;

  const propertyComments = useMemo(() => comments.filter((c) => c.propertyId === id), [comments, id]);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
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

  const photos = property.photos ?? [];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploads, setUploads] = useState<{ id: string; name: string; percent: number }[]>([]);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
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
  };

  const handleDeleteMedia = async (url: string) => {
    const current = usePropertiesStore.getState().properties.find((p) => p.id === id)?.photos ?? [];
    await updateProperty(id, { photos: current.filter((u) => u !== url) });
    deleteUpload(url).catch(() => {}); // best-effort object cleanup
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button asChild variant="ghost" size="icon" className="-ml-2 mt-1">
          <Link to="/properties"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{property.address}</h1>
            {property.isOffMarket && <Badge variant="secondary">Off-Market</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{property.suburb}</span>
            <span className="flex items-center gap-1"><Home className="h-3.5 w-3.5" />{property.bedrooms}bd / {property.bathrooms}ba</span>
            {property.priceGuide && <span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />{property.priceGuide}</span>}
          </div>
          {deal && (
            <Link to={`/deals/${deal.id}`} className="text-xs text-primary hover:underline mt-0.5 block">
              Part of: {deal.clientName}
            </Link>
          )}
        </div>
        <div className="flex gap-2 shrink-0">
          <Select
            value={property.status}
            onChange={(e) => updateProperty(id, { status: e.target.value as PropertyStatus })}
            className="w-36 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </Select>
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
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Price Guide</p>
                    <p className="font-semibold">{property.priceGuide || 'TBC'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Type</p>
                    <p className="font-semibold">{property.propertyType || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bedrooms</p>
                    <p className="font-semibold">{property.bedrooms}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Bathrooms</p>
                    <p className="font-semibold">{property.bathrooms}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Carparks</p>
                    <p className="font-semibold">{property.carparks}</p>
                  </div>
                  {property.landSize > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Land Size</p>
                      <p className="font-semibold">{property.landSize}m²</p>
                    </div>
                  )}
                </div>
                {property.sourceAgentName && (
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Source Agent</p>
                    <div className="flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                      <span className="text-sm">{property.sourceAgentName}</span>
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
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="internalNotes">Internal notes (staff only)</Label>
                  <Textarea
                    id="internalNotes"
                    value={property.notes}
                    onChange={(e) => updateProperty(id, { notes: e.target.value })}
                    rows={4}
                    placeholder="Internal observations, agent feedback, inspection notes..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientNotes">Client-visible notes</Label>
                  <Textarea
                    id="clientNotes"
                    value={property.clientVisibleNotes}
                    onChange={(e) => updateProperty(id, { clientVisibleNotes: e.target.value })}
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
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition-colors py-10 cursor-pointer text-center"
            >
              <Upload className="h-7 w-7 text-muted-foreground/50 mb-2" />
              <p className="text-sm font-medium">Click to upload or drag & drop</p>
              <p className="text-xs text-muted-foreground mt-1">Photos (≤15MB) and videos (≤200MB)</p>
            </div>

            {/* In-flight uploads */}
            {uploads.length > 0 && (
              <div className="space-y-2">
                {uploads.map((u) => (
                  <div key={u.id} className="flex items-center gap-3 text-sm">
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
              <div className="py-12 text-center">
                <ImageIcon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No media yet. Upload photos or videos of this property.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((url) => (
                  <div key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted">
                    {isVideoUrl(url) ? (
                      <video src={url} controls className="h-full w-full object-cover" />
                    ) : (
                      <img src={url} alt="Property media" loading="lazy" className="h-full w-full object-cover" />
                    )}
                    {isVideoUrl(url) && (
                      <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white flex items-center gap-1">
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
                  </div>
                ))}
              </div>
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
              <div className="py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No comments yet for this property.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {propertyComments.map((c) => (
                  <Card key={c.id} className="border-border/60">
                    <CardContent className="pt-3 pb-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {c.authorName[0]}
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
                          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{c.content}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
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
    </div>
  );
}
