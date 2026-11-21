import { getPoolTags, getPrimaryArtists, poolSafety } from "@/components/pools/aggregate"
import { listedConditions } from "@/components/posts/postQuery"
import { MAX_INT } from "@/core/objects/limits"
import { poolSummarySelect, postSummarySelect } from "@/core/objects/selects/summaries"
import { prisma } from "@/core/plugins/prisma"
import { rolePermissionCheck } from "@/core/utilities/permissionCache"
import { formatPostSummary } from "@/core/utilities/reformatters"
import { assertPostVisible, getBrowsingViewer } from "@/core/utilities/viewer"
import { FastifyPluginAsync } from "fastify"
import { Prisma } from "../../../prisma/client"
import { getPoolSummaries } from "@/components/pools/summary"
import { postVisibilitySelect } from "@/core/objects/selects/posts"
import { resolveTagNames } from "@/core/utilities/tags"

const POOL_SORTS = ['updated', 'newest', 'oldest', 'favorites', 'size', 'name'] as const;
type PoolSort = typeof POOL_SORTS[number];

// Every order ends on id so pages never shuffle when values tie
const POOL_ORDER: Record<PoolSort, Prisma.PoolOrderByWithRelationInput[]> = {
  updated: [{ updatedAt: 'desc' }, { id: 'desc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' },  { id: 'asc' }],
  favorites: [{ favoriteCount: 'desc' }, { id: 'desc' }],
  size: [{ items: { _count: 'desc' } }, { id: 'desc' }],
  name: [{ name: 'asc' }, { id: 'asc' }],
};

const viewPools: FastifyPluginAsync = async (fastify) => {

  // View a single pool + its posts in order
  fastify.get('/:id', {
    onRequest: [fastify.identify],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const viewer = await getBrowsingViewer(req);

    const pool = await prisma.pool.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        yearStart: true,
        yearEnd: true,
        favoriteCount: true,
        updatedAt: true,
        createdAt: true,
      },
    });

    // Only posts this viewer is allowed to see, same rules as the feed
    const items = pool
      ? await prisma.poolPost.findMany({
          where: { poolId: id, post: { AND: listedConditions(viewer) } },
          orderBy: { index: 'asc' },
          select: { post: { select: postSummarySelect } },
        })
      : [];

    // A pool with nothing visible looks exactly like a pool that doesn't exist
    // (except for people who can manage pools)
    const canManage = viewer.roleId !== null && rolePermissionCheck(viewer.roleId, 'pool.manage');
    if (!pool || (items.length === 0 && !canManage)) {
      return reply.status(404).send({ error: 'Not found', hint: 'No pool with that id' });
    }

    const posts = items.map((i) => i.post);
    const { tags, artists } = await getPoolTags(posts.map((p) => p.id));
    
    const favorite = viewer.userId
      ? await prisma.poolFavorite.findUnique({
          where: { userId_poolId: { userId: viewer.userId, poolId: id } },
          select: { poolId: true },
        })
      : null;

    return reply.status(200).send({
      ...pool,
      safety: poolSafety(posts),
      viewer: viewer.userId ? { favorited: favorite !== null } : null,
      artists,
      tags,
      posts: posts.map(formatPostSummary),
    });
  });

  // List / search pools
  fastify.get('/', {
    onRequest: [fastify.identify],
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          search: { type: 'string', maxLength: 256, default: '' },
          year: { type: 'integer', minimum: 1000, maximum: 3000 },
          sort: { type: 'string', enum: POOL_SORTS, default: 'updated' },
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 24 },
        },
      },
    },
  }, async (req, reply) => {
    const { search, year, sort, page, limit } = req.query as {
      search: string, year?: number, sort: PoolSort, page: number, limit: number,
    };
    const viewer = await getBrowsingViewer(req);
    const canManage = viewer.roleId !== null && rolePermissionCheck(viewer.roleId, 'pool.manage');
    const visiblePost: Prisma.PostWhereInput = { AND: listedConditions(viewer) };
    const text = search.trim();

    // Every word in the search bar, tried as a tag (aliases resolve to the real tag like they are supposed to)
    const words = text ? text.split(/\s+/) : [];
    const resolved = words.length > 0 ? await resolveTagNames(words) : null;

    // The tag side only counts if EVERY word was a real tag
    const tagIds = resolved && resolved.missing.length === 0 && resolved.invalid.length === 0
      ? resolved.tags.map((t) => t.id)
      : [];

    const where: Prisma.PoolWhereInput = {
      AND: [
        // Same rule as GET /:id: nothing visible = doesn't exist (managers also see empty pools)
        canManage ? {} : { items: { some: { post: visiblePost } } },

        text ? {
          OR: [
            { name: { contains: text, mode: 'insensitive' } },
            { description: { contains: text, mode: 'insensitive' } },

            // Or: the pool has every searched tag, each on at least one post
            ...(tagIds.length > 0 ? [{
              AND: tagIds.map((tagId) => ({
                items: { some: { post: { AND: [visiblePost, { tags: { some: { tagId } } }] } } },
              })),
            }] : []),
          ],
        } : {},

        // A single year, or a range that covers it
        year !== undefined ? {
          OR: [
            { yearStart: year, yearEnd: null },
            { yearStart: { lte: year }, yearEnd: { gte: year } },
          ],
        } : {},
      ],
    };

    const [pools, total] = await prisma.$transaction([
      prisma.pool.findMany({
        where,
        orderBy: POOL_ORDER[sort],
        skip: (page - 1) * limit,
        take: limit,
        select: poolSummarySelect,
      }),
      prisma.pool.count({ where }),
    ]);

    return reply.send({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      pools: await getPoolSummaries(pools, viewer),
    });
  });

  // Prev/next post inside a pool, from the post you're on. Skips posts hidden from you.
  fastify.get('/:id/navigate', {
    onRequest: [fastify.identify],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
      querystring: {
        type: 'object',
        required: ['current'],
        additionalProperties: false,
        properties: { current: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const { current } = req.query as { current: number };
    const viewer = await getBrowsingViewer(req);

    // The post must be in this pool AND visible to you; otherwise there's nothing to navigate from
    const item = await prisma.poolPost.findUnique({
      where: { poolId_postId: { poolId: id, postId: current } },
      select: { index: true, post: { select: postVisibilitySelect } },
    });
    assertPostVisible(viewer, item?.post ?? null);

    const visiblePost = { AND: listedConditions(viewer) };
    const [previous, next, before, total] = await Promise.all([
      prisma.poolPost.findFirst({
        where: { poolId: id, index: { lt: item!.index }, post: visiblePost },
        orderBy: { index: 'desc' },
        select: { postId: true },
      }),
      prisma.poolPost.findFirst({
        where: { poolId: id, index: { gt: item!.index }, post: visiblePost },
        orderBy: { index: 'asc' },
        select: { postId: true },
      }),
      prisma.poolPost.count({ where: { poolId: id, index: { lt: item!.index }, post: visiblePost } }),
      prisma.poolPost.count({ where: { poolId: id, post: visiblePost } }),
    ]);

    return reply.send({
      previousPostId: previous?.postId ?? null,
      nextPostId: next?.postId ?? null,
      position: before + 1, // 1-based, among the posts you can see
      total,
    });
  });
}

export default viewPools;