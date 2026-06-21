import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { AGREEMENT_MERGE_FIELDS } from '@rilo/shared';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered,
  Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Image as ImageIcon, Loader2, Braces, Highlighter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/upload';
import { toast } from 'sonner';
import { MergeField } from './extensions/MergeField';
import { FontSize } from './extensions/FontSize';
import { PageBreak } from './extensions/PageBreak';
import { ResizableImage } from './extensions/ResizableImage';
import { LogoBox } from './extensions/LogoBox';
import { SignatureBlock } from './extensions/SignatureBlock';
import { BLOCKS, BLOCK_MIME, insertBlock } from './blocks';
import { BlocksPanel } from './BlocksPanel';

const FONTS = [
  { label: 'Default (Inter)', value: '' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Courier', value: '"Courier New", monospace' },
];
const SIZES = ['', '10px', '11px', '12px', '13px', '14px', '16px', '18px', '20px', '24px', '28px'];

export interface AgreementEditorProps {
  value: string;
  onChange: (html: string) => void;
  editable?: boolean;
}

/** Small toolbar button. `active` reflects the current mark/node state. */
function ToolBtn({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:pointer-events-none',
        active && 'bg-primary/10 text-primary',
      )}
    >
      {children}
    </button>
  );
}

const Divider = () => <span className="mx-1 h-5 w-px bg-border" />;

function Toolbar({ editor, onInsertImage }: { editor: Editor; onInsertImage: () => void }) {
  const [showVars, setShowVars] = useState(false);
  const curFont = (editor.getAttributes('textStyle').fontFamily as string) || '';
  const curSize = (editor.getAttributes('textStyle').fontSize as string) || '';

  return (
    <div className="flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-input bg-muted/40 px-2 py-1.5">
      <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolBtn>

      <Divider />

      <select
        title="Font"
        value={curFont}
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontFamily(v).run();
          else editor.chain().focus().unsetFontFamily().run();
        }}
        className="h-8 rounded-md border border-input bg-background px-1.5 text-xs"
      >
        {FONTS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
      </select>
      <select
        title="Font size"
        value={curSize}
        onChange={(e) => {
          const v = e.target.value;
          if (v) editor.chain().focus().setFontSize(v).run();
          else editor.chain().focus().unsetFontSize().run();
        }}
        className="h-8 w-16 rounded-md border border-input bg-background px-1.5 text-xs"
      >
        {SIZES.map((s) => <option key={s || 'default'} value={s}>{s ? s.replace('px', '') : 'Size'}</option>)}
      </select>

      <Divider />

      {/* Text colour */}
      <label
        title="Text colour"
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onMouseDown={(e) => e.preventDefault()}
      >
        <span className="text-[13px] font-bold leading-none">A</span>
        <span className="absolute bottom-1.5 h-1 w-4 rounded-full" style={{ background: (editor.getAttributes('textStyle').color as string) || '#3f5e2f' }} />
        <input
          type="color"
          className="sr-only"
          value={(editor.getAttributes('textStyle').color as string) || '#3f5e2f'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      {/* Highlight / background colour */}
      <label
        title="Highlight colour"
        className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onMouseDown={(e) => e.preventDefault()}
      >
        <Highlighter className="h-4 w-4" />
        <input
          type="color"
          className="sr-only"
          value={(editor.getAttributes('highlight').color as string) || '#fde68a'}
          onChange={(e) => editor.chain().focus().setHighlight({ color: e.target.value }).run()}
        />
      </label>
      <ToolBtn title="Clear highlight" onClick={() => editor.chain().focus().unsetHighlight().run()}><span className="text-[11px] line-through">H</span></ToolBtn>

      <Divider />

      <ToolBtn title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolBtn>

      <Divider />

      <ToolBtn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Align centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolBtn>

      <Divider />

      <ToolBtn title="Insert image" onClick={onInsertImage}><ImageIcon className="h-4 w-4" /></ToolBtn>

      <div className="relative">
        <ToolBtn title="Insert merge field" active={showVars} onClick={() => setShowVars((v) => !v)}><Braces className="h-4 w-4" /></ToolBtn>
        {showVars && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowVars(false)} />
            <div className="absolute left-0 top-9 z-20 max-h-72 w-56 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Insert merge field</p>
              {AGREEMENT_MERGE_FIELDS.map((f) => (
                <button
                  key={f.token}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    editor.chain().focus().insertMergeField(f.token).run();
                    setShowVars(false);
                  }}
                  className="block w-full rounded-md px-2.5 py-1.5 text-left text-xs text-foreground hover:bg-muted"
                >
                  {f.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function AgreementEditor({ value, onChange, editable = true }: AgreementEditorProps) {
  const editorRef = useRef<Editor | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Where a picked image should land: a drop position, or null for the cursor.
  const pendingPos = useRef<number | null>(null);
  const [uploading, setUploading] = useState(false);

  const insertImage = useCallback(async (file: File, pos: number | null) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFile(file, { scope: 'document' });
      const ed = editorRef.current;
      if (!ed) return;
      if (typeof pos === 'number') ed.chain().focus().insertContentAt(pos, { type: 'image', attrs: { src: url } }).run();
      else ed.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  }, []);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      FontFamily,
      FontSize,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      ResizableImage.configure({ inline: false, allowBase64: false }),
      MergeField,
      PageBreak,
      LogoBox,
      SignatureBlock,
    ],
    content: value || '',
    editorProps: {
      attributes: { class: 'agreement-editor-content focus:outline-none' },
      handleDrop(view, event, _slice, moved) {
        if (moved) return false;
        const dt = (event as DragEvent).dataTransfer;
        if (!dt) return false;
        const at = view.posAtCoords({ left: (event as DragEvent).clientX, top: (event as DragEvent).clientY })?.pos ?? null;

        // Dropped image file → upload + insert where dropped.
        if (dt.files && dt.files.length && dt.files[0].type.startsWith('image/')) {
          event.preventDefault();
          void insertImage(dt.files[0], at);
          return true;
        }
        // Dropped block tile from the side rail.
        const blockId = dt.getData(BLOCK_MIME);
        if (blockId) {
          event.preventDefault();
          const block = BLOCKS.find((b) => b.id === blockId);
          const ed = editorRef.current;
          if (!block || !ed) return true;
          if (block.picksImage) { pendingPos.current = at; fileRef.current?.click(); return true; }
          insertBlock(ed, block, at ?? undefined);
          return true;
        }
        return false;
      },
      handlePaste(_view, event) {
        const items = (event as ClipboardEvent).clipboardData?.items;
        if (!items) return false;
        for (const it of items) {
          if (it.type.startsWith('image/')) {
            const file = it.getAsFile();
            if (file) { event.preventDefault(); void insertImage(file, null); return true; }
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  editorRef.current = editor;

  // Sync external value changes without clobbering the cursor while typing.
  useEffect(() => {
    if (!editor) return;
    const next = value || '';
    if (next !== editor.getHTML()) editor.commands.setContent(next, { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editable, editor]);

  const onFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const pos = pendingPos.current;
    pendingPos.current = null;
    if (file) void insertImage(file, pos);
  };

  if (!editor) return null;

  return (
    <div className="flex gap-5">
      <style>{EDITOR_CSS}</style>
      {editable && (
        <BlocksPanel editor={editor} onPickImage={() => { pendingPos.current = null; fileRef.current?.click(); }} disabled={uploading} />
      )}
      <div className="min-w-0 flex-1">
        {editable && <Toolbar editor={editor} onInsertImage={() => { pendingPos.current = null; fileRef.current?.click(); }} />}
        <div className={cn('rounded-b-xl border border-t-0 border-input bg-background', !editable && 'rounded-xl border-t')}>
          {/* The "page" — A4-ish column so authors see the real layout. */}
          <div className="mx-auto my-6 min-h-[60vh] w-full max-w-[760px] bg-white px-12 py-10 shadow-sm">
            <EditorContent editor={editor} />
          </div>
        </div>
        {uploading && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Uploading image…
          </p>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFilePicked} />
    </div>
  );
}

/* Editor-only styling for the WYSIWYG canvas (the PDF has its own print CSS). */
const EDITOR_CSS = `
.agreement-editor-content { font-family: 'Inter', system-ui, sans-serif; color: #111827; font-size: 11pt; line-height: 1.6; }
.agreement-editor-content:focus { outline: none; }
.agreement-editor-content h1 { font-size: 1.7em; font-weight: 700; margin: 0.6em 0 0.4em; }
.agreement-editor-content h2 { font-size: 1.3em; font-weight: 700; color: #3f5e2f; text-transform: uppercase; letter-spacing: .03em; margin: 0.8em 0 0.4em; }
.agreement-editor-content h3 { font-size: 1.1em; font-weight: 700; margin: 0.6em 0 0.3em; }
.agreement-editor-content p { margin: 0 0 0.6em; }
.agreement-editor-content ul, .agreement-editor-content ol { margin: 0 0 0.7em 1.4em; }
.agreement-editor-content li { margin: 0 0 0.3em; }
.agreement-editor-content a { color: #3f5e2f; text-decoration: underline; }
.agreement-editor-content img { max-width: 100%; height: auto; border-radius: 4px; }
.agreement-editor-content hr { border: 0; border-top: 1px solid #e5e7eb; margin: 1em 0; }
.agreement-editor-content blockquote { margin: 0 0 0.7em; padding: 4px 14px; border-left: 3px solid #3f5e2f; color: #555; }
.agreement-editor-content table { width: 100%; border-collapse: collapse; margin: 0 0 0.7em; }
.agreement-editor-content td, .agreement-editor-content th { border: 1px solid #e5e7eb; padding: 6px 8px; }
.agreement-editor-content .page-break {
  height: 0; margin: 1.4em 0; border-top: 2px dashed #c9b8a0; position: relative;
}
.agreement-editor-content .page-break::after {
  content: 'Page break'; position: absolute; right: 0; top: -0.7em;
  background: #faf6ee; padding: 0 6px; font-size: 10px; color: #9a8868; letter-spacing: .04em;
}
.agreement-editor-content .ProseMirror-selectednode { outline: 2px solid #3f5e2f55; border-radius: 4px; }
`;
