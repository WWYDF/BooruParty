
// Just to prevent abuse on creation
export const MAX_POST_SOURCES = 10;
export const MAX_POST_SOURCE_LENGTH = 512;
export const MAX_POST_NOTES_LENGTH = 2048;
export const MAX_POST_TAGS = 300;
export const MAX_RELATED_POSTS = 100;
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024; // 100 MB
export const MAX_THUMBNAIL_BYTES = 20 * 1024 * 1024; // 20 MB