import { prisma } from "@/core/prisma";

/**
 * Synchronizes pool affiliation by checking existing ones
 * and adding/removing the new/old pairs.
 *
 * @param postId - The ID of the post being updated
 * @param desiredPoolIds - The array of destination pool IDs
 */

export async function syncPostPools(postId: number, desiredPoolIds: number[]) {
  const current = await prisma.poolItems.findMany({
    where: { postId },
    select: { poolId: true },
  });

  const currentIds = new Set(current.map(p => p.poolId));
  const desiredIds = [...new Set(desiredPoolIds)];

  const toAdd = desiredIds.filter(id => !currentIds.has(id));
  const toRemove = [...currentIds].filter(id => !desiredIds.includes(id));

  const addData = await Promise.all(
    toAdd.map(async (poolId) => {
      const maxIndex = await prisma.poolItems.aggregate({
        where: { poolId },
        _max: { index: true },
      });
      return {
        poolId,
        postId,
        index: (maxIndex._max.index ?? -1) + 1,
      };
    })
  );

  await prisma.$transaction([
    prisma.poolItems.deleteMany({ where: { postId, poolId: { in: toRemove } } }),
    prisma.poolItems.createMany({ data: addData }),
  ]);
}
