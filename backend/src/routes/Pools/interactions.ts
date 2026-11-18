import { FastifyPluginAsync } from "fastify";
import { visiblePoolConditions } from "@/components/pools/visibility";
import { MAX_INT } from "@/core/objects/limits";
import { prisma } from "@/core/plugins/prisma";
import { HttpError, isMissingRowError } from "@/core/utilities/errors";
import { requirePermission } from "@/core/utilities/permissionCache";
import { getBrowsingViewer } from "@/core/utilities/viewer";

const poolInteractions: FastifyPluginAsync = async (fastify) => {

  // Favorite (true) or unfavorite (false) a pool
  fastify.put('/:id/favorite', {
    onRequest: [fastify.authenticate, requirePermission('pool.favorite')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
      body: {
        type: 'object',
        required: ['favorited'],
        additionalProperties: false,
        properties: { favorited: { type: 'boolean' } },
      },
    },
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const { favorited } = req.body as { favorited: boolean };
    const userId = req.user.sub;

    // You can only favorite a pool you can see
    const viewer = await getBrowsingViewer(req);
    const pool = await prisma.pool.findFirst({ where: { id, ...visiblePoolConditions(viewer) }, select: { id: true } });
    if (!pool) throw new HttpError(404, { error: 'Not found', hint: 'No pool with that id' });;

    try {
      const favoriteCount = await prisma.$transaction(async (tx) => {
        // Only move the counter when a row was actually added/removed (repeat clicks = no-op)
        const { count } = favorited
          ? await tx.poolFavorite.createMany({ data: [{ poolId: id, userId }], skipDuplicates: true })
          : await tx.poolFavorite.deleteMany({ where: { poolId: id, userId } });

        const updated = await tx.pool.update({
          where: { id },
          data: count > 0 ? { favoriteCount: { increment: favorited ? 1 : -1 } } : {},
          select: { favoriteCount: true },
        });
        return updated.favoriteCount;
      });

      return reply.send({ favorited, favoriteCount });
    } catch (e) {
      // Pool deleted between the check and the write
      if (isMissingRowError(e)) throw new HttpError(404, { error: 'Not found', hint: 'No pool with that id' });;
      throw e;
    }
  });

};

export default poolInteractions;
