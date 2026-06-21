import type { Editor } from '@tiptap/react';
import { Heading, Pilcrow, Minus, Image as ImageIcon, Scissors, PenLine, Stamp, type LucideIcon } from 'lucide-react';

/** A draggable/insertable building block offered in the editor's left rail. */
export interface BlockDef {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Content inserted via insertContent / insertContentAt (HTML string or node spec). */
  content?: string | Record<string, unknown>;
  /** Image blocks open the file picker instead of inserting content directly. */
  picksImage?: boolean;
}

export const BLOCKS: BlockDef[] = [
  { id: 'heading', label: 'Heading', description: 'Section title', icon: Heading, content: '<h2>Section heading</h2>' },
  { id: 'paragraph', label: 'Paragraph', description: 'Body text', icon: Pilcrow, content: '<p>New paragraph…</p>' },
  { id: 'divider', label: 'Divider', description: 'Horizontal rule', icon: Minus, content: { type: 'horizontalRule' } },
  { id: 'image', label: 'Image', description: 'Upload a picture', icon: ImageIcon, picksImage: true },
  { id: 'logo', label: 'Logo', description: 'Fixed-size logo box', icon: Stamp, content: { type: 'logoBox' } },
  { id: 'signature', label: 'Signature', description: 'Where the client signs', icon: PenLine, content: { type: 'signatureBlock' } },
  { id: 'pagebreak', label: 'Page break', description: 'Start a new page', icon: Scissors, content: { type: 'pageBreak' } },
];

export const BLOCK_MIME = 'application/x-agreement-block';

/**
 * Insert a block's content into the editor — at `pos` when dropped, otherwise at
 * the current selection. Image blocks are handled by the caller (file picker).
 */
export function insertBlock(editor: Editor, block: BlockDef, pos?: number): void {
  if (block.picksImage || block.content == null) return;
  const chain = editor.chain().focus();
  if (typeof pos === 'number') chain.insertContentAt(pos, block.content);
  else chain.insertContent(block.content);
  chain.run();
}
