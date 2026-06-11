import { request } from '@/lib/api';

const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200 MB

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
  if (!isImage && !isVideo) {
    throw new Error('Only image and video files are allowed.');
  }
  const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > cap) {
    throw new Error(`File is too large (max ${isVideo ? '200MB' : '15MB'}).`);
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
