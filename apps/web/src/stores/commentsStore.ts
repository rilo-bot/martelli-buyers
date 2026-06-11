import { create } from 'zustand';
import { resource } from '@/lib/api';
import type { ClientComment, CommentAttachment } from '@/types';

const api = resource<ClientComment>('comments');

interface CommentsState {
  comments: ClientComment[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  addComment: (comment: Omit<ClientComment, 'id' | 'createdAt'>) => Promise<ClientComment>;
  updateComment: (id: string, updates: Partial<ClientComment>) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  addAttachment: (commentId: string, attachment: CommentAttachment) => Promise<void>;
  getCommentsForDeal: (dealId: string) => ClientComment[];
  getCommentsForProperty: (propertyId: string) => ClientComment[];
}

export const useCommentsStore = create<CommentsState>()((set, get) => ({
  comments: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const comments = await api.list();
      set({ comments, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  addComment: async (data) => {
    const comment = await api.create(data);
    set((s) => ({ comments: [...s.comments, comment] }));
    return comment;
  },

  updateComment: async (id, updates) => {
    const updated = await api.update(id, updates);
    set((s) => ({ comments: s.comments.map((c) => (c.id === id ? updated : c)) }));
  },

  deleteComment: async (id) => {
    await api.remove(id);
    set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }));
  },

  addAttachment: (commentId, attachment) => {
    const comment = get().comments.find((c) => c.id === commentId);
    if (!comment) return Promise.resolve();
    return get().updateComment(commentId, { attachments: [...comment.attachments, attachment] });
  },

  getCommentsForDeal: (dealId) => get().comments.filter((c) => c.dealId === dealId),
  getCommentsForProperty: (propertyId) => get().comments.filter((c) => c.propertyId === propertyId),
}));
