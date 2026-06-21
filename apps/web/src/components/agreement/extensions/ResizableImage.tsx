import { Image } from '@tiptap/extension-image';
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useRef } from 'react';

/**
 * Image with drag-to-resize. Extends the standard Image node with a `width`
 * attribute (serialised as the HTML `width` attribute so the PDF honours it) and
 * a React node view that shows a corner handle when the image is selected. The
 * same node doubles as a logo — just resize it small.
 */
function ImageView({ node, updateAttributes, selected, editor }: NodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const width = node.attrs.width as number | null;

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = imgRef.current?.offsetWidth ?? 0;
    const onMove = (ev: PointerEvent) => {
      const next = Math.max(40, Math.round(startW + (ev.clientX - startX)));
      updateAttributes({ width: next });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <NodeViewWrapper className="resizable-image" style={{ display: 'inline-block', position: 'relative', lineHeight: 0 }}>
      <img
        ref={imgRef}
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string) || ''}
        draggable={false}
        data-drag-handle
        style={{ width: width ? `${width}px` : 'auto', maxWidth: '100%', borderRadius: 4, outline: selected ? '2px solid #3f5e2f' : 'none' }}
      />
      {selected && editor.isEditable && (
        <span
          onPointerDown={startResize}
          title="Drag to resize"
          style={{
            position: 'absolute', right: -5, bottom: -1, width: 12, height: 12,
            background: '#3f5e2f', border: '2px solid #fff', borderRadius: 3, cursor: 'nwse-resize',
          }}
        />
      )}
    </NodeViewWrapper>
  );
}

export const ResizableImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).getAttribute('width');
          return w ? parseInt(w, 10) : null;
        },
        renderHTML: (attrs) => (attrs.width ? { width: attrs.width } : {}),
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageView);
  },
});
