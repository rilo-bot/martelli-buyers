import { useCallback, useRef, useState } from 'react';
import { Upload, Trash2, ImageIcon, Film, FileText, Loader2, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile, deleteUpload, isVideoUrl, isDocUrl, fileExtFromUrl } from '@/lib/upload';
import { EmptyState } from '@/components/ui/empty-state';
import { Stagger, StaggerItem } from '@/components/motion';
import { toast } from 'sonner';

// Images, videos and documents — mirrors what the uploads endpoint accepts.
const ACCEPT =
  'image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

interface InFlight {
  id: string;
  name: string;
  percent: number;
}

export interface MediaUploaderProps {
  /** Current list of stored public URLs. */
  value: string[];
  /**
   * Called with the full next list whenever an item is added or removed. May be
   * async (e.g. persisting to a store); the uploader awaits it before clearing
   * its in-flight state. Used in two ways: persist immediately (detail pages)
   * or collect locally until a form is submitted (add forms).
   */
  onChange: (next: string[]) => void | Promise<void>;
  /** Upload scope (S3 key prefix), e.g. 'property'. */
  scope?: string;
  /** Scope id for grouping uploads under a record. */
  scopeId?: string;
  /** Smaller dropzone + gallery, for use inside form drawers. */
  compact?: boolean;
  /** Disable all interaction (e.g. while a parent is busy). */
  disabled?: boolean;
}

/**
 * Drag-and-drop uploader for property media — images, videos and documents.
 * Renders the dropzone, in-flight progress, and a gallery with per-item delete
 * (images open a lightbox, videos play inline, documents open in a new tab).
 */
export function MediaUploader({
  value,
  onChange,
  scope = 'property',
  scopeId,
  compact = false,
  disabled = false,
}: MediaUploaderProps) {
  const [uploads, setUploads] = useState<InFlight[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // A batch of files is uploaded sequentially; keep the latest list in a ref so
  // each upload appends to the freshest value rather than clobbering siblings.
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length || disabled) return;
      for (const file of Array.from(files)) {
        const tempId = crypto.randomUUID();
        setUploads((u) => [...u, { id: tempId, name: file.name, percent: 0 }]);
        try {
          const url = await uploadFile(file, {
            scope,
            scopeId,
            onProgress: (p) =>
              setUploads((u) => u.map((x) => (x.id === tempId ? { ...x, percent: p } : x))),
          });
          const next = [...valueRef.current, url];
          valueRef.current = next;
          await onChange(next);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : `Failed to upload ${file.name}.`);
        } finally {
          setUploads((u) => u.filter((x) => x.id !== tempId));
        }
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onChange, scope, scopeId, disabled],
  );

  const handleDelete = useCallback(
    async (url: string) => {
      const next = valueRef.current.filter((u) => u !== url);
      valueRef.current = next;
      await onChange(next);
      deleteUpload(url).catch(() => {}); // best-effort object cleanup
      setLightbox((cur) => (cur === url ? null : cur));
    },
    [onChange],
  );

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div
        onClick={() => !disabled && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragActive(true); }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFiles(e.dataTransfer.files); }}
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors',
          compact ? 'py-6' : 'py-10',
          disabled
            ? 'cursor-not-allowed opacity-60 border-border'
            : dragActive
              ? 'border-primary bg-primary/5 cursor-pointer'
              : 'border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer',
        )}
      >
        <Upload className={cn('mb-2 transition-colors', compact ? 'h-5 w-5' : 'h-7 w-7', dragActive ? 'text-primary' : 'text-muted-foreground/50')} />
        <p className="text-sm font-medium">{dragActive ? 'Drop to upload' : 'Click to upload or drag & drop'}</p>
        <p className="text-xs text-muted-foreground mt-1">Images (≤15MB), videos (≤200MB) and documents (≤25MB)</p>
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
      {value.length === 0 && uploads.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No media yet"
          description="Upload photos, videos or documents for this property."
          compact
        />
      ) : (
        <Stagger className={cn('grid gap-3', compact ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4')} step={0.03}>
          {value.map((url) => (
            <StaggerItem key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted">
              {isVideoUrl(url) ? (
                <video src={url} controls className="h-full w-full object-cover" />
              ) : isDocUrl(url) ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full w-full flex-col items-center justify-center gap-1.5 p-2 text-center transition-colors hover:bg-muted-foreground/5"
                >
                  <FileText className="h-7 w-7 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground">{fileExtFromUrl(url)}</span>
                  <span className="flex items-center gap-1 text-[10px] text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    <ExternalLink className="h-3 w-3" />Open
                  </span>
                </a>
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
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(url)}
                  className="absolute right-1.5 top-1.5 rounded-md bg-black/60 p-1.5 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
                  aria-label="Delete media"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </StaggerItem>
          ))}
        </Stagger>
      )}

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
    </div>
  );
}
