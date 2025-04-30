
export const FILE_TYPE_LABELS: Record<string, string> = {
  png: "Image",
  webp: "Image",
  gif: "Animated",
};

// This should match whats in Fastify.
export const FILE_TYPE_MAP: Record<'image' | 'animated' | 'video' | 'other', string[]> = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'],
  animated: ['.gif', '.apng'],
  video: ['.mp4', '.webm', '.mov', '.avi', '.mkv'],
  other: []
};

export type FileType = keyof typeof FILE_TYPE_MAP;

export function resolveFileType(ext: string): FileType {
  const lowered = ext.toLowerCase();

  for (const type of Object.keys(FILE_TYPE_MAP) as FileType[]) {
    if (FILE_TYPE_MAP[type].includes(lowered)) {
      return type;
    }
  }

  return 'other';
}