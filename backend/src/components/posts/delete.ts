import { Prisma } from "../../../prisma/client";
import { Db } from "@/core/plugins/prisma";
import { appLogger } from "@/core/plugins/logger";
import { discardFiles, postFilePaths } from "@/components/uploads/finalize";
import { getServerSettings, loadServerSettings } from "@/core/utilities/settingsCache";

const logger = appLogger('Posts/Delete');

// What a delete route reads up front: the owner (for the perm check) and the files (for cleanup)
export const postDeleteSelect = {
  id: true, uploaderId: true, fileKey: true, thumbKey: true, originalPath: true, previewPath: true,
} as const;
export type PostToDelete = Prisma.PostGetPayload<{ select: typeof postDeleteSelect }>;

// Deletes posts and keeps tag + collection counters in sync. Run inside a transaction.
// Returns the ids actually deleted (any already gone are left out)
export async function deletePosts(tx: Db, ids: number[]): Promise<number[]> {
  // Lock the rows, always in id order: two overlapping bulk deletes then queue instead of deadlocking
  const locked = await tx.$queryRaw<{ id: number }[]>`
    SELECT id FROM "Post" WHERE id = ANY(${ids}) ORDER BY id FOR UPDATE`;
  const lockedIds = locked.map((r) => r.id);
  if (lockedIds.length === 0) return [];

  // Each tag loses 1 per deleted post it was on. Must run BEFORE the cascade removes the PostTag rows
  await tx.$executeRaw`
    UPDATE "Tag" t SET "postCount" = t."postCount" - c.n
    FROM (SELECT "tagId", COUNT(*)::int AS n FROM "PostTag" WHERE "postId" = ANY(${lockedIds}) GROUP BY "tagId") c
    WHERE t.id = c."tagId"`;

  // Same for collections
  await tx.$executeRaw`
    UPDATE "PostCollection" pc SET "itemCount" = pc."itemCount" - c.n
    FROM (SELECT "collectionId", COUNT(*)::int AS n FROM "PostCollectionItem" WHERE "postId" = ANY(${lockedIds}) GROUP BY "collectionId") c
    WHERE pc.id = c."collectionId"`;

  await tx.post.deleteMany({ where: { id: { in: lockedIds } } }); // cascades PostTag + PostCollectionItem rows
  return lockedIds;
}

// Call only AFTER the commit: if the tx had failed, the posts would still need their files
export async function cleanupDeletedPosts(posts: PostToDelete[]) {
  for (const post of posts) {
    try {
      await discardFiles(postFilePaths(post));
    } catch (e) {
      logger.error(`Post ${post.id} deleted, but some of its files could not be removed`, e);
    }
  }

  // If the featured post was one of them, refresh the serverSettings cache
  if (posts.some((p) => p.id === getServerSettings().featuredPostId)) await loadServerSettings();
}
