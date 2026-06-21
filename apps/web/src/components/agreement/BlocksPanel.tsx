import type { Editor } from '@tiptap/react';
import { BLOCKS, BLOCK_MIME, insertBlock, type BlockDef } from './blocks';

/**
 * Left rail of building blocks. Each tile can be clicked (insert at the cursor)
 * or dragged onto the page (insert where dropped — handled by the editor's drop
 * handler). Image blocks open the file picker via `onPickImage`.
 */
export function BlocksPanel({
  editor,
  onPickImage,
  disabled,
}: {
  editor: Editor;
  onPickImage: () => void;
  disabled?: boolean;
}) {
  const activate = (block: BlockDef) => {
    if (disabled) return;
    if (block.picksImage) onPickImage();
    else insertBlock(editor, block);
  };

  return (
    <div className="w-52 shrink-0">
      <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Insert blocks
      </p>
      <div className="space-y-1.5">
        {BLOCKS.map((block) => {
          const Icon = block.icon;
          return (
            <button
              key={block.id}
              type="button"
              draggable={!disabled}
              onDragStart={(e) => e.dataTransfer.setData(BLOCK_MIME, block.id)}
              onClick={() => activate(block)}
              disabled={disabled}
              className="flex w-full items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{block.label}</span>
                <span className="block truncate text-xs text-muted-foreground">{block.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 px-1 text-xs text-muted-foreground">
        Click to insert at the cursor, or drag onto the page.
      </p>
    </div>
  );
}
