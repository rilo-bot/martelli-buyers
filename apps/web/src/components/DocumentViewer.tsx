import * as React from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { Download, Loader2, FileWarning } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { fetchBlob, ApiError } from '@/lib/api'

// pdf.js needs its worker; Vite resolves the `?url` import to a served asset.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

const isPdf = (m: string): boolean => m === 'application/pdf'
const isImage = (m: string): boolean => m.startsWith('image/')
const isPreviewable = (m: string): boolean => isPdf(m) || isImage(m)

export interface DocumentViewerProps {
  open: boolean
  onClose: () => void
  title: string
  /** MIME type — decides PDF vs image vs unsupported. */
  mimeType: string
  /** API path that streams the file inline for preview (must NOT force download). */
  previewPath: string
  /** Show the Download button (owner/admin only). The server is the real gate. */
  canDownload: boolean
  /** Invoked when the user clicks Download. */
  onDownload?: () => void | Promise<void>
}

/**
 * In-app document viewer. Fetches the file as a blob and renders it from an
 * in-memory URL (PDFs via pdf.js canvases, images via <img>) so a non-owner is
 * never handed a directly-saveable link or a viewer toolbar. Download is offered
 * only to owners/admins; everyone else is preview-only.
 */
export function DocumentViewer({
  open,
  onClose,
  title,
  mimeType,
  previewPath,
  canDownload,
  onDownload,
}: DocumentViewerProps) {
  const pagesRef = React.useRef<HTMLDivElement>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [imageUrl, setImageUrl] = React.useState<string | null>(null)
  const [downloading, setDownloading] = React.useState(false)

  const previewable = isPreviewable(mimeType)

  React.useEffect(() => {
    if (!open || !previewable) return
    let cancelled = false
    let objectUrl: string | null = null
    let pdfDoc: pdfjsLib.PDFDocumentProxy | null = null
    setLoading(true)
    setError('')
    setImageUrl(null)

    ;(async () => {
      try {
        const blob = await fetchBlob(previewPath)
        if (cancelled) return
        if (isImage(mimeType)) {
          objectUrl = URL.createObjectURL(blob)
          setImageUrl(objectUrl)
          return
        }
        const data = await blob.arrayBuffer()
        if (cancelled) return
        pdfDoc = await pdfjsLib.getDocument({ data }).promise
        if (cancelled) {
          pdfDoc.destroy()
          return
        }
        const container = pagesRef.current
        if (!container) return
        container.innerHTML = ''
        for (let n = 1; n <= pdfDoc.numPages; n++) {
          if (cancelled) return
          const page = await pdfDoc.getPage(n)
          const viewport = page.getViewport({ scale: 1.5 })
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')
          if (!ctx) continue
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.className = 'mx-auto mb-3 max-w-full rounded shadow-sm'
          container.appendChild(canvas)
          await page.render({ canvasContext: ctx, viewport }).promise
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Could not load this preview.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      if (pdfDoc) pdfDoc.destroy()
      if (pagesRef.current) pagesRef.current.innerHTML = ''
    }
  }, [open, previewPath, mimeType, previewable])

  const handleDownload = async () => {
    if (!onDownload) return
    setDownloading(true)
    try {
      await onDownload()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent
        className="flex h-[85vh] max-w-4xl flex-col gap-0 p-0"
        // Deterrent: block the right-click "Save as" menu over the preview.
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 className="truncate text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-2 pr-8">
            {canDownload && onDownload && (
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={handleDownload} disabled={downloading}>
                {downloading
                  ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  : <Download className="mr-1.5 h-3.5 w-3.5" />}
                Download
              </Button>
            )}
          </div>
        </div>

        <div className="relative flex-1 overflow-auto bg-muted/30 p-4 [user-select:none]">
          {!previewable ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <FileWarning className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm font-medium">Preview not available for this file type</p>
              <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                {canDownload
                  ? 'Download the file to open it on your device.'
                  : 'Only the document owner can download this file.'}
              </p>
            </div>
          ) : error ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <FileWarning className="mb-3 h-10 w-10 text-destructive/70" />
              <p className="max-w-sm text-sm text-muted-foreground">{error}</p>
            </div>
          ) : imageUrl ? (
            <img src={imageUrl} alt={title} className="mx-auto max-w-full rounded shadow-sm" draggable={false} />
          ) : (
            // The pages container must stay mounted while loading so the render
            // effect can find it via the ref; the spinner overlays it instead of
            // replacing it (otherwise pagesRef.current is null and nothing draws).
            <>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <div ref={pagesRef} />
            </>
          )}
        </div>

        {!canDownload && previewable && (
          <div className="border-t border-border px-4 py-2 text-center text-[11px] text-muted-foreground">
            Preview only — downloading is restricted to the document owner.
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
