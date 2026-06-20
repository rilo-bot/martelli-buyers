import { create } from 'zustand';
import { resource, request } from '@/lib/api';
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
  /**
   * Resolve a short-lived presigned URL to view/download a document. The bucket
   * is private, so `doc.url` won't open directly — always go through this.
   * Owner/admin only on the server (anti-download gate); non-owners get a 403.
   */
  fileUrl: (id: string, opts?: { download?: boolean }) => Promise<string>;
  /** API path that streams a document inline for in-app preview (no save). */
  previewPath: (id: string) => string;
  /** Fetch a presigned save URL (owner/admin only) and trigger a browser download. */
  triggerFileDownload: (id: string) => Promise<void>;
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

  fileUrl: async (id, opts) => {
    const path = `/api/documents/${id}/download${opts?.download ? '?download=1' : ''}`;
    const { url } = await request<{ url: string }>('GET', path);
    return url;
  },

  previewPath: (id) => `/api/documents/${id}/preview`,

  triggerFileDownload: async (id) => {
    // Presigned URL carries Content-Disposition: attachment, so navigating to it
    // saves the file rather than opening it. Owner/admin only (server-enforced).
    const url = await get().fileUrl(id, { download: true });
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  },

  forEntity: (entityType, entityId) =>
    get().documents.filter((d) => d.entityType === entityType && d.entityId === entityId),
}));
