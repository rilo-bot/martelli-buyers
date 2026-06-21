import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useRef, useState } from 'react';
import { ImagePlus, Loader2 } from 'lucide-react';
import { uploadFile } from '@/lib/upload';
import { toast } from 'sonner';

/**
 * A fixed-size (120×120) square logo placeholder. Clicking it uploads an image
 * (to S3) and pins it inside the square (object-fit: contain). Serialises to
 * `<div class="logo-box"><img …></div>`, which the print stylesheet renders at
 * the same fixed size in the PDF. Typically placed in the document header.
 */

export const LOGO_SIZE = 120;

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    logoBox: {
      insertLogoBox: () => ReturnType;
    };
  }
}

function LogoView({ node, updateAttributes, editor }: NodeViewProps) {
  const src = node.attrs.src as string | null;
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => { if (editor.isEditable) fileRef.current?.click(); };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return; }
    setBusy(true);
    try {
      const url = await uploadFile(file, { scope: 'document' });
      updateAttributes({ src: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Logo upload failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <NodeViewWrapper className="logo-box-wrap" style={{ display: 'inline-block' }}>
      <button
        type="button"
        onClick={pick}
        title={editor.isEditable ? 'Click to set logo' : undefined}
        style={{
          width: LOGO_SIZE, height: LOGO_SIZE, display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: src ? '1px solid #e5e7eb' : '2px dashed #c9b8a0', borderRadius: 8, overflow: 'hidden',
          background: src ? '#fff' : '#faf6ee', cursor: editor.isEditable ? 'pointer' : 'default', color: '#9a8868',
        }}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : src ? (
          <img src={src} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
        ) : (
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <ImagePlus className="h-5 w-5" /> Logo
          </span>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    </NodeViewWrapper>
  );
}

export const LogoBox = Node.create({
  name: 'logoBox',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).querySelector('img')?.getAttribute('src') ?? null,
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.logo-box' }];
  },

  renderHTML({ node }) {
    const src = node.attrs.src as string | null;
    const attrs = mergeAttributes({ class: 'logo-box' });
    return src ? ['div', attrs, ['img', { src, alt: 'Logo' }]] : ['div', attrs];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LogoView);
  },

  addCommands() {
    return {
      insertLogoBox: () => ({ commands }) => commands.insertContent({ type: this.name }),
    };
  },
});
