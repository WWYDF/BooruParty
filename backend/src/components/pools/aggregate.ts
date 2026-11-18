import { prisma } from "@/core/plugins/prisma";
import { Safety } from "../../../prisma/client";
import { TagSummary, tagSummarySelect } from "@/core/objects/selects/summaries";

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


// Primary artist for many pools at once (pools list cards)
// postIdsByPool = each pool's VISIBLE post ids
export async function getPrimaryArtists(postIdsByPool: Map<number, number[]>) {
  const result = new Map<number, TagSummary>();
  const allPostIds = [...new Set([...postIdsByPool.values()].flat())];
  if (allPostIds.length === 0) return result;

  // Only creator tags, so this stays small even for big pools
  const rows = await prisma.postTag.findMany({
    where: { postId: { in: allPostIds }, tag: { category: { flags: { has: 'CREATOR' } } } },
    select: { postId: true, tag: { select: tagSummarySelect } },
  });

  const tagsByPost = new Map<number, TagSummary[]>();
  for (const { postId, tag } of rows) {
    const list = tagsByPost.get(postId);
    if (list) list.push(tag);
    else tagsByPost.set(postId, [tag]);
  }

  for (const [poolId, postIds] of postIdsByPool) {
    // Count each creator tag across this pool's posts
    const counts = new Map<number, { tag: TagSummary, n: number }>();
    for (const postId of postIds) {
      for (const tag of tagsByPost.get(postId) ?? []) {
        const entry = counts.get(tag.id);
        if (entry) entry.n++;
        else counts.set(tag.id, { tag, n: 1 });
      }
    }

    let best: { tag: TagSummary, n: number } | null = null;
    for (const entry of counts.values()) {
      if (!best || entry.n > best.n || (entry.n === best.n && entry.tag.name.localeCompare(best.tag.name) < 0)) {
        best = entry;
      }
    }
    if (best) result.set(poolId, best.tag);
  }

  return result;
}