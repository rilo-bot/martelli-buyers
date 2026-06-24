import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useState } from 'react';
import { PenLine, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFile } from '@/lib/upload';
import { useAuthStore } from '@/stores/authStore';
import { SignatureDialog, type SignatureResult } from '../SignatureDialog';

/**
 * Signature block. Click it to sign — a dialog lets you draw or type, and on OK
 * the signature is embedded into the agreement (drawn signatures are uploaded to
 * S3; typed names render in a script font). Serialises to
 * `<div class="signature-block">…</div>` with the signature inside.
 *
 * Left empty, it stays a placeholder: the server fills it with the client's
 * signature when they sign via the public link.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    signatureBlock: {
      insertSignatureBlock: () => ReturnType;
    };
  }
}

function SignatureView({ node, updateAttributes, editor }: NodeViewProps) {
  const src = node.attrs.src as string | null;
  const name = node.attrs.name as string | null;
  const currentUserName = useAuthStore((s) => s.currentUser?.name ?? '');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const signed = Boolean(src || name);

  const onConfirm = async (result: SignatureResult) => {
    if (result.dataUrl) {
      setBusy(true);
      try {
        const blob = await (await fetch(result.dataUrl)).blob();
        const file = new File([blob], 'signature.png', { type: 'image/png' });
        const url = await uploadFile(file, { scope: 'document' });
        updateAttributes({ src: url, name: result.name });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save signature.');
        return;
      } finally {
        setBusy(false);
      }
    } else {
      updateAttributes({ src: null, name: result.name });
    }
    setOpen(false);
  };

  const openDialog = () => { if (editor.isEditable) setOpen(true); };

  return (
    <NodeViewWrapper className="signature-block-wrap">
      {signed ? (
        <div
          contentEditable={false}
          onClick={openDialog}
          style={{ margin: '14px 0', cursor: editor.isEditable ? 'pointer' : 'default', display: 'inline-block' }}
          title={editor.isEditable ? 'Click to change signature' : undefined}
        >
          {src ? (
            <img src={src} alt="Signature" style={{ maxHeight: 80, maxWidth: 260, display: 'block' }} />
          ) : (
            <span style={{ fontFamily: '"Dancing Script", "Segoe Script", "Brush Script MT", cursive', fontSize: 26, color: '#111827' }}>
              {name}
            </span>
          )}
          <div style={{ width: 260, borderBottom: '1px solid #6b7280', margin: '4px 0 6px' }} />
          {name && <div style={{ fontSize: 12, color: '#374151' }}>{name}</div>}
        </div>
      ) : (
        <div
          contentEditable={false}
          onClick={openDialog}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0',
            border: '2px dashed #b6c2a6', borderRadius: 8, background: '#f4f7ef',
            padding: '14px 16px', color: '#3f5e2f', cursor: editor.isEditable ? 'pointer' : 'default',
          }}
        >
          {busy ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <PenLine className="h-5 w-5 shrink-0" />}
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {editor.isEditable ? 'Click to sign' : 'Signature'}
            <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: '#6b7280' }}>
              Draw or type your signature — or leave blank for the client to sign via their link.
            </span>
          </span>
        </div>
      )}

      {editor.isEditable && (
        <SignatureDialog
          open={open}
          onClose={() => setOpen(false)}
          onConfirm={onConfirm}
          initialName={name || currentUserName}
          busy={busy}
        />
      )}
    </NodeViewWrapper>
  );
}

export const SignatureBlock = Node.create({
  name: 'signatureBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).querySelector('img.sig-img')?.getAttribute('src') ?? null,
        renderHTML: () => ({}),
      },
      name: {
        default: null,
        parseHTML: (el) => {
          const node = el as HTMLElement;
          return node.querySelector('.sig-name')?.textContent
            || node.querySelector('.sig-typed')?.textContent
            || null;
        },
        renderHTML: () => ({}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div.signature-block' }];
  },

  renderHTML({ node }) {
    const src = node.attrs.src as string | null;
    const name = node.attrs.name as string | null;
    const base = mergeAttributes({ class: 'signature-block' });
    if (src) {
      return ['div', { ...base, 'data-signed': '1' },
        ['img', { src, class: 'sig-img', alt: 'Signature' }],
        ['div', { class: 'sig-line' }],
        ['span', { class: 'sig-name' }, name || ''],
      ];
    }
    if (name) {
      return ['div', { ...base, 'data-signed': '1' },
        ['span', { class: 'sig-typed' }, name],
        ['div', { class: 'sig-line' }],
      ];
    }
    return ['div', base];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SignatureView);
  },

  addCommands() {
    return {
      insertSignatureBlock: () => ({ commands }) => commands.insertContent({ type: this.name }),
    };
  },
});
