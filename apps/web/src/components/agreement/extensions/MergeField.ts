import { Node, mergeAttributes } from '@tiptap/core';
import { AGREEMENT_MERGE_FIELDS } from '@rilo/shared';

/**
 * Inline "merge field" chip (e.g. the client's name) inserted into the agreement
 * text. It's an atom node so it behaves as a single unit while editing. On save
 * it serialises to `<span data-merge-field="token">Label</span>`, which the
 * server resolves to the real value at PDF build (see lib/pdf/agreementHtml.ts).
 */

const LABELS: Record<string, string> = Object.fromEntries(
  AGREEMENT_MERGE_FIELDS.map((f) => [f.token, f.label]),
);

const CHIP_STYLE =
  'background:#e9efe4;color:#3f5e2f;border-radius:4px;padding:0 6px;font-weight:600;font-size:0.92em;white-space:nowrap;';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mergeField: {
      /** Insert a merge-field chip for the given token at the selection. */
      insertMergeField: (token: string) => ReturnType;
    };
  }
}

export const MergeField = Node.create({
  name: 'mergeField',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      token: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-merge-field'),
        renderHTML: (attrs) => (attrs.token ? { 'data-merge-field': attrs.token } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-merge-field]' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const token = node.attrs.token as string;
    const label = LABELS[token] ?? token;
    return ['span', mergeAttributes(HTMLAttributes, { class: 'merge-chip', style: CHIP_STYLE }), label];
  },

  // Plain-text copy/paste falls back to the {{token}} form.
  renderText({ node }) {
    return `{{${node.attrs.token}}}`;
  },

  addCommands() {
    return {
      insertMergeField:
        (token: string) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { token } }),
    };
  },
});
