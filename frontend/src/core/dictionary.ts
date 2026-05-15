// This should match whats in Fastify.
export const ALLOWED_EXTENSIONS = [
  'png', 'jpg', 'jpeg', 'webp', 'bmp', 'tiff',
  'gif', 'apng',
  'mp4', 'webm', 'mov', 'avi', 'mkv', 'quicktime'
];

export type FileTypes = 'image' | 'animated' | 'video';

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


// Dashboard Stuff
export const auditLogColors: Record<string, string> = {
  EDIT: "text-yellow-400",
  DELETE: "text-red-500",
  CREATE: "text-green-500",
  UPDATE: "text-blue-400",
  ARCHIVE: "text-pink",
};