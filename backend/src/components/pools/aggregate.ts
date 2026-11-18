import { prisma } from "@/core/plugins/prisma";
import { Safety } from "../../../prisma/client";
import { tagSummarySelect } from "@/core/objects/selects/summaries";

// Enum declaration order = most to least safe
const SAFETY_ORDER = Object.values(Safety);

// The most unsafe rating among these posts (empty is null)
export function poolSafety(posts: { safety: Safety }[]): Safety | null {
  let max: Safety | null = null;
  for (const { safety } of posts) {
    if (max === null || SAFETY_ORDER.indexOf(safety) > SAFETY_ORDER.indexOf(max)) max = safety;
  }
  return max;
}

// Every tag used by these posts, with how many of them carry it (most common placed first)
// Artists = tags in a category tagged "CREATOR". First one in the pool is primary for now
export async function getPoolTags(postIds: number[]) {
  if (postIds.length === 0) return { tags: [], artists: [] };

  const counts = await prisma.postTag.groupBy({
    by: ['tagId'],
    where: { postId: { in: postIds } },
    _count: { tagId: true }
  });
  const countById = new Map(counts.map((c) => [c.tagId, c._count.tagId]));

  const rows = await prisma.tag.findMany({
    where: { id: { in: [...countById.keys()] } },
    select: { ...tagSummarySelect, category: { select: { flags: true } } },
  });

  const tags = rows
    .map(({ category, ...tag }) => ({
      ...tag,
      poolCount: countById.get(tag.id) ?? 0,
      isCreator: category.flags.includes('CREATOR'),
    }))
    .sort((a, b) => b.poolCount - a.poolCount || a.name.localeCompare(b.name));

  return {
    tags: tags.map(({ isCreator, ...tag }) => tag),
    artists: tags.filter((t) => t.isCreator).map(({ isCreator, ...tag }) => tag),
  }
}