import { request } from '@/lib/api';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB
const MAX_DOC_BYTES = 25 * 1024 * 1024; // 25 MB

// Document MIME types accepted for DD evidence (LIM reports, titles, etc.).
const DOC_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

/** True when the file is an accepted document type (not image/video). */
export function isDocType(file: File): boolean {
  return DOC_TYPES.has(file.type);
}

export interface UploadOptions {
  scope?: string;
  scopeId?: string;
  onProgress?: (percent: number) => void;
}

interface SignResponse {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

/** Client-side guard before we bother the server / S3. Throws on invalid file. */
function validate(file: File): void {
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isDoc = isDocType(file);
  if (!isImage && !isVideo && !isDoc) {
    throw new Error('Only image, video and document (PDF, Word, Excel) files are allowed.');
  }
  const cap = isVideo ? MAX_VIDEO_BYTES : isDoc ? MAX_DOC_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    const label = isVideo ? '200MB' : isDoc ? '25MB' : '15MB';
    throw new Error(`File is too large (max ${label}).`);
  }
}

/** PUT the raw file straight to S3 via the presigned URL, reporting progress. */
function putToS3(uploadUrl: string, file: File, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status}).`));
    xhr.onerror = () => reject(new Error('Upload failed — check your connection and S3 CORS.'));
    xhr.send(file);
  });
}

/** Upload a file to S3 and return its permanent public URL. */
export async function uploadFile(file: File, opts: UploadOptions = {}): Promise<string> {
  validate(file);
  const { uploadUrl, publicUrl } = await request<SignResponse>('POST', '/api/uploads/sign', {
    filename: file.name,
    contentType: file.type,
    scope: opts.scope ?? 'misc',
    scopeId: opts.scopeId,
  });
  await putToS3(uploadUrl, file, opts.onProgress);
  return publicUrl;
}

/** Delete an uploaded object by its public URL (best-effort). */
export async function deleteUpload(url: string): Promise<void> {
  await request('DELETE', '/api/uploads', { url });
}

/** True if a stored media URL points at a video (by extension). */
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(url);
}
