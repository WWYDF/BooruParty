// Functions that take in objects and replace specific parts (idk bro just look at it smh)

import { THUMBNAIL_SIZES, ThumbnailSize } from "@/components/uploads/thumbnails";
import { PostSummary } from "../objects/selects/summaries";
import { PostDetail } from "../objects/selects/posts";

// Strip any trailing slash so we never end up with "//data/..."
const PUBLIC_URL = (process.env.BACKEND_URL ?? '').replace(/\/+$/, '');

export function withAssetUrls<T extends Record<string, any>>(obj: T, keys: (keyof T)[]): T {
  const out = { ...obj };

  for (const key of keys) {
    const value = out[key];
    if (typeof value === 'string') {
      out[key] = `${PUBLIC_URL}${value}` as T[typeof key];
    }
  }

  return out;
}

// Thumbnails aren't stored since they follow a consistent format.
// Their paths are derived from fileKey.
export function thumbnailUrls(fileKey: string): Record<ThumbnailSize, string> {
  return Object.fromEntries(
    Object.keys(THUMBNAIL_SIZES).map((size) => [size, `${PUBLIC_URL}/data/thumbnails/${fileKey}_${size}.webp`])
  ) as Record<ThumbnailSize, string>
}

// Feed card
export function formatPostSummary(post: PostSummary) {
  return { ...post, thumbnails: thumbnailUrls(post.fileKey) };
}

// Single post page
export function formatPostDetail(post: PostDetail) {
  const { tags, fileSize, previewSize, ...rest } = post;
  return {
    ...withAssetUrls(rest, ['originalPath', 'previewPath']),
    thumbnails: thumbnailUrls(post.fileKey),
    fileSize: Number(fileSize),
    previewSize: previewSize === null ? null : Number(previewSize),
    tags: tags.map((t) => t.tag),
  };
}