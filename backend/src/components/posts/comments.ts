
// Allowed external hosts

import { MAX_COMMENT_EMBEDS, MAX_INT } from "@/core/objects/limits";
import { HttpError } from "@/core/utilities/errors";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";

// Overritten by process.env.COMMENT_MEDIA_HOSTS
export const DEFAULT_MEDIA_HOSTS = [
  'media.giphy.com',
  'i.giphy.com',
  'i.imgur.com',
  'media.tenor.com',
  'media1.tenor.com',
  'klipy.com'
];

let mediaHosts: Set<string> | null = null;
function allowedMediaHosts(): Set<string> {
  // Read lazily cause process.env isn't guaranteed to be loaded when this module is imported
  if (!mediaHosts) {
    const fromEnv = process.env.COMMENT_MEDIA_HOSTS?.split(',').map((h) => h.trim().toLowerCase()).filter(Boolean);
    mediaHosts = new Set(fromEnv?.length ? fromEnv : DEFAULT_MEDIA_HOSTS);
  }
  return mediaHosts;
}

const POST_EMBED = /:(\d{1,10}):/g; // ":123:"
const URL_PATTERN = /https?:\/\/[^\s<>"']+/g; // any http(s) link in the text

export type CommentEmbeds = {
  postIds: number[], // unique, in order of first appearance
  media: string[], // unique https URLs on an allowed host (rendered as images/gifs)
}

// Finds the embeds in a comment. Hyperlinks aren't embeds, so they stay plaintext.
export function parseEmbeds(content: string): CommentEmbeds {
  const postIds = [...new Set(
    [...content.matchAll(POST_EMBED)].map((m) => Number(m[1])).filter((id) => id >= 1 && id <= MAX_INT),
  )];

  const media = new Set<string>();
  for (const [raw] of content.matchAll(URL_PATTERN)) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'https:' && allowedMediaHosts().has(url.hostname.toLowerCase())) media.add(raw);
    } catch {}
  }

  return { postIds, media: [...media] };
}

// Throws an HttpError if this role may not post these embeds. Used by POST and PATCH.
export function assertEmbedsAllowed(embeds: CommentEmbeds, roleId: string) {
  if (embeds.postIds.length + embeds.media.length > MAX_COMMENT_EMBEDS) {
    throw new HttpError(400, { error: 'Too many embeds', hint: `A comment can embed at most ${MAX_COMMENT_EMBEDS} posts/GIFs` });
  }
  if (embeds.postIds.length && !rolePermissionCheck(roleId, 'comment.embed.post')) {
    throw new HttpError(403, { error: 'Forbidden', hint: 'Missing permission: comment.embed.post' });
  }
  if (embeds.media.length && !rolePermissionCheck(roleId, 'comment.embed.url')) {
    throw new HttpError(403, { error: 'Forbidden', hint: 'Missing permission: comment.embed.url' });
  }
}
