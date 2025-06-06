export const FILE_TYPE_MAP: Record<'image' | 'animated' | 'video' | 'other', string[]> = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'],
  animated: ['.gif', '.apng'],
  video: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
  other: [] // fallback
};

export type FileType = keyof typeof FILE_TYPE_MAP;

export function resolveFileType(ext: string): FileType {
  const lowered = ext.toLowerCase();

  for (const [type, extensions] of Object.entries(FILE_TYPE_MAP)) {
    if (extensions.includes(lowered)) return type as FileType;
  }

  return 'other';
}

export type PreviewFile = {
  previewScale: number | null,
  assignedExt: 'mp4' | 'webm' | 'mkv' | 'webp' | 'gif' | null,
  // Just extensions that we encode previews to.
}