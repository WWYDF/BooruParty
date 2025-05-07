import { prisma } from "@/core/prisma";

/**
 * Synchronizes bidirectional post relations by clearing all existing ones
 * and re-adding the symmetric pairs.
 *
 * @param postId - The ID of the post being updated
 * @param relatedIds - The array of related post IDs
 */
export async function syncPostRelations(postId: number, relatedIds: number[]) {
  if (!Array.isArray(relatedIds)) return;

  // Remove duplicates and prevent self-linking
  const cleanIds = [...new Set(relatedIds)].filter(id => id !== postId);

  await prisma.$transaction([
    // Remove all current relations for this post
    prisma.postRelation.deleteMany({
      where: {
        OR: [
          { fromId: postId },
          { toId: postId },
        ],
      },
    }),
    // Recreate symmetric relations
    prisma.postRelation.createMany({
      data: cleanIds.flatMap((targetId) => [
        { fromId: postId, toId: targetId },
        { fromId: targetId, toId: postId },
      ]),
      skipDuplicates: true,
    }),
  ]);
}
