
// Just to prevent abuse on creation
export const MAX_POST_SOURCES = 10;
export const MAX_POST_SOURCE_LENGTH = 512;
export const MAX_POST_NOTES_LENGTH = 2048;
export const MAX_POST_TAGS = 300;
export const MAX_RELATED_POSTS = 100;
export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024; // 100 MB
export const MAX_THUMBNAIL_BYTES = 20 * 1024 * 1024; // 20 MB
export const MAX_INT = 2_147_483_647; // Postgres int4; bigger ids can't exist and would make the lookup query throw. should I have thought about this before rewriting everything? yes. Am I going to fix it now? lol no

// Comments
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_COMMENT_EMBEDS = 2; 