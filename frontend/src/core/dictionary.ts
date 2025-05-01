
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

export const DISALLOWED_USERNAMES = [
  "admin",
  "administrator",
  "root",
  "moderator",
  "support",
  "staff",
  "system",
  "null",
  "undefined",
  "api",
  "setup",
  "login",
  "register",
  "me",
  "deleted",
  "anonymous"
];

export const ALLOWED_EMBED_SOURCES: Record<string, "image" | "iframe"> = {
  "cdn.discordapp.com": "image",
  "media.tenor.com": "image",
  "media1.tenor.com": "image",
  "c.tenor.com": "image",
  // Later additions:
  // "youtube.com": "iframe",
  // "youtu.be": "iframe",
};