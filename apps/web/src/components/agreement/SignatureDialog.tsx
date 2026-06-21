import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Pen, Type, Eraser, Undo2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type SignMode = 'draw' | 'type';

export interface SignatureResult {
  /** A drawn signature as a PNG data URL (uploaded by the caller). */
  dataUrl?: string;
  /** The signer's name (always captured; doubles as the typed signature). */
  name: string;
}

/**
 * Capture a signature by drawing or typing — the same draw/type UX as the public
 * signing page, reused inside the agreement editor. Returns the result to the
 * caller, which embeds it into the document.
 */
export function SignatureDialog({
  open, onClose, onConfirm, initialName = '', busy = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (result: SignatureResult) => void;
  initialName?: string;
  busy?: boolean;
}) {
  const [mode, setMode] = useState<SignMode>('draw');
  const [name, setName] = useState(initialName);
  const [hasDrawing, setHasDrawing] = useState(false);
  const padRef = useRef<SignatureCanvas | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { if (open) setName(initialName); }, [open, initialName]);

  // Size the canvas backing store to its rendered box (avoids pen offset).
  useEffect(() => {
    if (!open || mode !== 'draw') return;
    const resize = () => {
      const pad = padRef.current;
      const wrap = wrapRef.current;
      if (!pad || !wrap) return;
      const canvas = pad.getCanvas();
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = wrap.clientWidth * ratio;
      canvas.height = wrap.clientHeight * ratio;
      canvas.getContext('2d')?.scale(ratio, ratio);
      pad.clear();
      setHasDrawing(false);
    };
    // Defer until the dialog has laid out.
    const t = setTimeout(resize, 30);
    window.addEventListener('resize', resize);
    return () => { clearTimeout(t); window.removeEventListener('resize', resize); };
  }, [open, mode]);

  const clearPad = () => { padRef.current?.clear(); setHasDrawing(false); };
  const undoStroke = () => {
    const pad = padRef.current;
    if (!pad) return;
    const data = pad.toData();
    if (!data.length) return;
    data.pop();
    pad.fromData(data);
    setHasDrawing(data.length > 0);
  };

  const canConfirm = !!name.trim() && (mode === 'type' || hasDrawing) && !busy;

  const confirm = () => {
    if (!canConfirm) return;
    if (mode === 'draw') {
      const pad = padRef.current;
      if (!pad || pad.isEmpty()) return;
      onConfirm({ dataUrl: pad.getCanvas().toDataURL('image/png'), name: name.trim() });
    } else {
      onConfirm({ name: name.trim() });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add signature</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-sm">
            <button type="button" onClick={() => setMode('draw')} className={tab(mode === 'draw')}><Pen className="h-4 w-4" /> Draw</button>
            <button type="button" onClick={() => setMode('type')} className={tab(mode === 'type')}><Type className="h-4 w-4" /> Type</button>
          </div>

          {mode === 'draw' ? (
            <div ref={wrapRef} className="relative h-40 rounded-lg border border-dashed border-border bg-background">
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
                <button type="button" onClick={undoStroke} disabled={!hasDrawing} className={miniBtn}><Undo2 className="h-3.5 w-3.5" /> Undo</button>
                <button type="button" onClick={clearPad} disabled={!hasDrawing} className={miniBtn}><Eraser className="h-3.5 w-3.5" /> Clear</button>
              </div>
            </div>
          ) : (
            <div className="flex min-h-[5rem] items-center rounded-lg border border-dashed border-border bg-background px-4">
              <span className="text-3xl text-foreground" style={{ fontFamily: '"Dancing Script", "Segoe Script", "Brush Script MT", cursive' }}>
                {name.trim() || 'Your signature'}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="sig-name">Full name *</Label>
            <Input id="sig-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jane Smith" autoComplete="name" />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost">Cancel</Button>
          </DialogClose>
          <Button type="button" onClick={confirm} disabled={!canConfirm}>
            {busy ? 'Adding…' : 'OK'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const tab = (active: boolean) =>
  `inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-medium transition-colors ${active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`;
const miniBtn = 'inline-flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40';
