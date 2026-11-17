import type { Safety } from '@/core/types/posts';

export const SAFETY_LEVELS: Safety[] = ['SAFE', 'QUESTIONABLE', 'EXPLICIT'];

export const SAFETY_STYLES: Record<Safety, { label: string; short: string; active: string; badge: string }> = {
  SAFE: { label: 'Safe', short: 'S', active: 'bg-green-600 text-white', badge: 'bg-green-600/90 text-white' },
  QUESTIONABLE: { label: 'Questionable', short: 'Q', active: 'bg-yellow-400 text-black', badge: 'bg-yellow-400/90 text-black' },
  EXPLICIT: { label: 'Explicit', short: 'E', active: 'bg-red-600 text-white', badge: 'bg-red-600/90 text-white' },
};

// A tag picked in the UI. Uploads only allow existing tags (the create API rejects unknown ones);
// the post editor may add new ones (isNew), which PATCH creates on save if the user has tags.create.
export type TagChip = { name: string; color?: string; isNew?: boolean; postCount?: number };

export type UploadStatus =
  | { state: 'queued' }
  | { state: 'uploading'; progress: number } // 0..1 of the file's bytes sent
  | { state: 'processing' }                  // bytes sent, server is generating thumbnails/previews
  | { state: 'done'; postId: number }
  | { state: 'duplicate'; postId: number }
  | { state: 'error'; message: string };

export type UploadItem = {
  id: string;
  file: File;
  thumbnail: string | null;  // object URL of a small locally generated thumbnail
  thumbnailFailed: boolean;  // browser couldn't decode it (e.g. .mkv, HEIC); the server may still accept it
  safety: Safety;
  tags: TagChip[];           // tags for this file only (the "for every file" tags are added at upload)
  sourcesText: string;       // raw textarea value, one URL per line; parsed at upload
  notes: string;
  status: UploadStatus;
};

// Files that haven't been sent (or need another try) can still be edited
export function isEditable(item: UploadItem) {
  return item.status.state === 'queued' || item.status.state === 'error' || item.status.state === 'duplicate';
}

export function parseSources(text: string): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    try {
      const url = new URL(line);
      (url.protocol === 'http:' || url.protocol === 'https:' ? valid : invalid).push(line);
    } catch {
      invalid.push(line);
    }
  }
  return { valid, invalid };
}
