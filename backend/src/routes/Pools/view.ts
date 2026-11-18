import { visibleConditions } from "@/components/posts/postQuery"
import { MAX_INT } from "@/core/objects/limits"
import { poolSummarySelect, postSummarySelect } from "@/core/objects/selects/summaries"
import { prisma } from "@/core/plugins/prisma"
import { HttpError } from "@/core/utilities/errors"
import { rolePermissionCheck } from "@/core/utilities/permissionCache"
import { formatPostSummary } from "@/core/utilities/reformatters"
import { getBrowsingViewer } from "@/core/utilities/viewer"
import { FastifyPluginAsync } from "fastify"

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
      return reply.send(404).send({ error: 'Not found', hint: 'No pool with that id' });
    }
    
    return reply.status(200).send({
      ...pool,
      posts: items.map((i) => formatPostSummary(i.post)),
    });
  })
}

export default viewPools;