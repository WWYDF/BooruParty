import { visibleConditions } from "@/components/posts/postQuery";
import { PoolSummary, postSummarySelect } from "@/core/objects/selects/summaries"; // merge into existing import
import { prisma } from "@/core/plugins/prisma";
import { formatPoolSummary } from "@/core/utilities/reformatters";
import { Viewer } from "@/core/utilities/viewer";
import { getPrimaryArtists, poolSafety } from "./aggregate";

// Ready-to-send pool cards for any set of pools, in the order given. 3 queries total.
export async function getPoolSummaries(pools: PoolSummary[], viewer: Viewer) {
  if (pools.length === 0) return [];

  // Visible posts of these pools, in pool order (ids + safety only)
  const items = await prisma.poolPost.findMany({
    where: { poolId: { in: pools.map((p) => p.id) }, post: { AND: visibleConditions(viewer) } },
    orderBy: [{ poolId: 'asc' }, { index: 'asc' }],
    select: { poolId: true, postId: true, post: { select: { safety: true } } },
  });

  const itemsByPool = new Map<number, typeof items>();
  for (const item of items) {
    const list = itemsByPool.get(item.poolId);
    if (list) list.push(item);
    else itemsByPool.set(item.poolId, [item]);
  }

  // Cover = first visible post of each pool
  const coverIds = [...itemsByPool.values()].map((list) => list[0].postId);
  const [covers, artists] = await Promise.all([
    coverIds.length ? prisma.post.findMany({ where: { id: { in: coverIds } }, select: postSummarySelect }) : [],
    getPrimaryArtists(new Map([...itemsByPool].map(([poolId, list]) => [poolId, list.map((i) => i.postId)]))),
  ]);
  const coverById = new Map(covers.map((p) => [p.id, p]));

  return pools.map((pool) => {
    const list = itemsByPool.get(pool.id) ?? [];
    return formatPoolSummary(pool, {
      postCount: list.length,
      safety: poolSafety(list.map((i) => i.post)),
      cover: list.length ? coverById.get(list[0].postId) ?? null : null,
      artist: artists.get(pool.id) ?? null,
    });
  });
}
