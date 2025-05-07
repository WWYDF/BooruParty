import { prisma } from "@/core/prisma";

/**
 * Synchronizes bidirectional post relations by cross checking existing ones
 * and adding/removing the new/old pairs.
 *
 * @param postId - The ID of the post being updated
 * @param relatedIds - The array of related post IDs
 */

export async function syncPostRelations(postId: number, relatedIds: number[]) {
  const cleanIds = [...new Set(relatedIds)].filter(id => id !== postId);
  const current = await prisma.postRelation.findMany({
    where: { OR: [{ fromId: postId }, { toId: postId }] },
  });

  const currentIds = new Set(
    current.flatMap(r => [r.fromId === postId ? r.toId : r.fromId])
  );

  const toAdd = cleanIds.filter(id => !currentIds.has(id));
  const toRemove = [...currentIds].filter(id => !cleanIds.includes(id));

  await prisma.$transaction([
    ...toAdd.flatMap((targetId) => [
      prisma.postRelation.create({ data: { fromId: postId, toId: targetId } }),
      prisma.postRelation.create({ data: { fromId: targetId, toId: postId } }),
    ]),
    prisma.postRelation.deleteMany({
      where: {
        OR: toRemove.flatMap((id) => [
          { fromId: postId, toId: id },
          { fromId: id, toId: postId },
        ]),
      },
    }),
  ]);
}