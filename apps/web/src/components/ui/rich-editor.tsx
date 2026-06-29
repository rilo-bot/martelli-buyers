import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Image } from '@tiptap/extension-image';
import {
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered,
  Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, Loader2, Braces,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { uploadFile } from '@/lib/upload';
import { toast } from 'sonner';
import type { EditorPlaceholderGroup } from '@/lib/templateVariables';

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  /**
   * Grouped placeholders shown in the "Insert placeholder" menu. Built via
   * `composePlaceholderGroups` (live record values) or `catalogPlaceholderGroups`
   * (authoring). Omit/empty to hide the menu entirely.
   */
  placeholders?: EditorPlaceholderGroup[];
  className?: string;
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

/**
 * Searchable, grouped "Insert placeholder" menu. Each row inserts either a live
 * resolved value (composing against a record) or the raw `{{token}}` (authoring
 * / per-recipient), per the item's `insert` field.
 */
function PlaceholderMenu({ editor, groups }: { editor: Editor; groups: EditorPlaceholderGroup[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            it.token.toLowerCase().includes(q) ||
            (it.value ?? '').toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  const insert = (text: string) => {
    editor.chain().focus().insertContent(text).run();
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <span className="mx-1 h-5 w-px bg-border" />
      <div className="relative">
        <ToolBtn title="Insert placeholder" active={open} onClick={() => setOpen((v) => !v)}>
          <Braces className="h-4 w-4" />
        </ToolBtn>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div className="absolute left-0 top-9 z-20 w-72 rounded-lg border border-border bg-popover shadow-lg">
              <div className="border-b border-border p-2">
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search placeholders…"
                  className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="max-h-72 overflow-y-auto p-1">
                {filtered.length === 0 ? (
                  <p className="px-2.5 py-3 text-center text-xs text-muted-foreground">No placeholders match.</p>
                ) : (
                  filtered.map((group) => (
                    <div key={group.label} className="mb-1 last:mb-0">
                      <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {group.label}
                      </p>
                      {group.items.map((it) => (
                        <button
                          key={it.token}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => insert(it.insert)}
                          className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted"
                          title={it.value ? `Inserts: ${it.value}` : `Inserts ${it.token}`}
                        >
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-xs font-medium text-foreground">{it.label}</span>
                            {it.value !== undefined ? (
                              <span className="shrink-0 truncate text-[11px] text-primary" style={{ maxWidth: '55%' }}>
                                → {it.value}
                              </span>
                            ) : (
                              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{it.token}</span>
                            )}
                          </span>
                          {it.hint && (
                            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{it.hint}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Toolbar({ editor, placeholders }: { editor: Editor; placeholders: EditorPlaceholderGroup[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const hasPlaceholders = placeholders.some((g) => g.items.length > 0);

  const addLink = () => {
    const prev = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL', prev ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  const onImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    setUploading(true);
    try {
      // Email images must be hosted (S3) — base64 is stripped by most clients.
      const url = await uploadFile(file, { scope: 'email' });
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-input bg-muted/30 px-1.5 py-1">
      <ToolBtn title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></ToolBtn>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolBtn title="Heading" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Subheading" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolBtn>

      <span className="mx-1 h-5 w-px bg-border" />

      {/* Text colour — native picker keeps the toolbar light-weight. */}
      <label
        title="Text colour"
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onMouseDown={(e) => e.preventDefault()}
      >
        <span className="text-[13px] font-bold leading-none">A</span>
        <span
          className="absolute mt-4 h-1 w-4 rounded-full"
          style={{ background: (editor.getAttributes('textStyle').color as string) || '#1e6fb0' }}
        />
        <input
          type="color"
          className="sr-only"
          value={(editor.getAttributes('textStyle').color as string) || '#1e6fb0'}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>

      <ToolBtn title="Link" active={editor.isActive('link')} onClick={addLink}><LinkIcon className="h-4 w-4" /></ToolBtn>
      <ToolBtn title="Insert image" disabled={uploading} onClick={() => fileRef.current?.click()}>
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
      </ToolBtn>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageFile} />

      {hasPlaceholders && <PlaceholderMenu editor={editor} groups={placeholders} />}
    </div>
  );
}

export function RichTextEditor({
  value, onChange, placeholder, placeholders = [], className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      Image.configure({ inline: false }),
    ],
    content: value || '',
    editorProps: {
      attributes: {
        class: cn(
          'rich-editor-content min-h-[220px] w-full px-3 py-2.5 text-sm leading-relaxed',
          'focus:outline-none',
        ),
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  // Sync external value changes (e.g. selecting a template) without clobbering
  // the user's cursor while they type — only reset when the incoming value truly
  // differs from the current document.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '';
    if (next !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  return (
    <div className={cn('overflow-hidden rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring', className)}>
      {editor && <Toolbar editor={editor} placeholders={placeholders} />}
      <EditorContent editor={editor} data-placeholder={placeholder} />
    </div>
  );
}
