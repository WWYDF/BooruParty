import { getPoolTags, getPrimaryArtists, poolSafety } from "@/components/pools/aggregate"
import { visibleConditions } from "@/components/posts/postQuery"
import { MAX_INT } from "@/core/objects/limits"
import { poolSummarySelect, postSummarySelect } from "@/core/objects/selects/summaries"
import { prisma } from "@/core/plugins/prisma"
import { rolePermissionCheck } from "@/core/utilities/permissionCache"
import { formatPostSummary } from "@/core/utilities/reformatters"
import { getBrowsingViewer } from "@/core/utilities/viewer"
import { FastifyPluginAsync } from "fastify"
import { Prisma } from "../../../prisma/client"
import { getPoolSummaries } from "@/components/pools/summary"

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
          where: { poolId: id, post: { AND: visibleConditions(viewer) } },
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
    const visiblePost: Prisma.PostWhereInput = { AND: visibleConditions(viewer) };
    const text = search.trim();

    const where: Prisma.PoolWhereInput = {
      AND: [
        // Same rule as GET /:id: nothing visible = doesn't exist (managers also see empty pools)
        canManage ? {} : { items: { some: { post: visiblePost } } },

        text ? {
          OR: [
            { name: { contains: text, mode: 'insensitive' } },
            { description: { contains: text, mode: 'insensitive' } },
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
}

export default viewPools;