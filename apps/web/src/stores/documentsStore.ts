import { create } from 'zustand';
import { resource } from '@/lib/api';
import { uploadFileWithKey } from '@/lib/upload';
import type { Document, DocumentCategory, DocumentEntityType } from '@/types';

type DocumentCategoryOrBlank = DocumentCategory | '';

const api = resource<Document>('documents');

/** Where an uploaded file should be attached, plus how to catalogue it. */
export interface AttachTarget {
  entityType: DocumentEntityType;
  entityId: string;
  /** Denormalised Buyer Journey id, when the entity belongs to one. */
  dealId?: string;
  category?: DocumentCategoryOrBlank;
  uploadedBy?: string;
  /** Override the catalogued name (defaults to the file's name). */
  name?: string;
  onProgress?: (percent: number) => void;
}

interface DocumentsState {
  documents: Document[];
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
  /** Upload a file to S3 then create its Document record linked to the target. */
  uploadAndAttach: (file: File, target: AttachTarget) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  /** Documents currently attached to a given entity (local cache). */
  forEntity: (entityType: string, entityId: string) => Document[];
}

export const useDocumentsStore = create<DocumentsState>()((set, get) => ({
  documents: [],
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const documents = await api.list();
      set({ documents, loaded: true });
    } finally {
      set({ loading: false });
    }
  },

  uploadAndAttach: async (file, target) => {
    const { url, key } = await uploadFileWithKey(file, {
      scope: target.entityType,
      scopeId: target.entityId,
      onProgress: target.onProgress,
    });
    const doc = await api.create({
      name: target.name?.trim() || file.name,
      url,
      storageKey: key,
      mimeType: file.type,
      size: file.size,
      category: target.category ?? '',
      entityType: target.entityType,
      entityId: target.entityId,
      dealId: target.dealId ?? '',
      uploadedBy: target.uploadedBy ?? '',
      tags: [],
    });
    set((s) => ({ documents: [...s.documents, doc] }));
    return doc;
  },

  deleteDocument: async (id) => {
    await api.remove(id);
    set((s) => ({ documents: s.documents.filter((d) => d.id !== id) }));
  },

  forEntity: (entityType, entityId) =>
    get().documents.filter((d) => d.entityType === entityType && d.entityId === entityId),
}));
