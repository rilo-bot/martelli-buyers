import { Node, mergeAttributes } from '@tiptap/core';

/**
 * A hard page break. Serialises to `<div class="page-break">`, which the print
 * stylesheet turns into `break-after: page` so the agreement paginates where the
 * author intends. In the editor it shows as a labelled dashed divider.
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    pageBreak: {
      insertPageBreak: () => ReturnType;
    };
  }
}

export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div.page-break' }];
  },

  renderHTML() {
    return ['div', mergeAttributes({ class: 'page-break', 'data-page-break': 'true' })];
  },

  addCommands() {
    return {
      insertPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    };
  },
});
