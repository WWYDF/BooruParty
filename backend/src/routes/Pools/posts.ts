import { MAX_INT, MAX_POOL_BATCH, MAX_POOL_POSTS } from "@/core/objects/limits";
import { FastifyPluginAsync } from "fastify";
import { Prisma, Safety } from "../../../prisma/client";
import { HttpError, isMissingRowError } from "@/core/utilities/errors";
import { requirePermission } from "@/core/utilities/permissionCache";
import { getViewer } from "@/core/utilities/viewer";
import { prisma } from "@/core/plugins/prisma";
import { visibleConditions } from "@/components/posts/postQuery";

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
};

const postIdsBody = {
  type: 'object',
  required: ['postIds'],
  additionalProperties: false,
  properties: {
    postIds: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_POOL_BATCH,
      uniqueItems: true,
      items: { type: 'integer', minimum: 1, maximum: MAX_INT },
    },
  },
};

// Bumps updatedAt AND locks the pool row until the transaction ends. 404 if it's gone.
async function touchPool(tx: Prisma.TransactionClient, id: number) {
  const { count } = await tx.pool.updateMany({ where: { id }, data: { updatedAt: new Date() } });
  if (count === 0) throw new HttpError(404, { error: 'Not found', hint: 'No pool with that id' });
}

const poolPosts: FastifyPluginAsync = async (fastify) => {

  // Add posts to the end of a pool, in the order given. Ones already in it are skipped.
  fastify.post('/:id/posts', {
    onRequest: [fastify.authenticate, requirePermission('pool.manage')],
    schema: { params: idParams, body: postIdsBody },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const { postIds } = req.body as { postIds: number[] };
    const viewer = await getViewer(req);

    // Editors can only add posts they can see. Hidden and nonexistent give the same answer
    const visible = await prisma.post.count({
      where: { AND: [{ id: { in: postIds } }, ...visibleConditions(viewer, Object.values(Safety))] },
    });
    if (visible !== postIds.length) {
      throw new HttpError(400, { error: 'Bad Request', hint: 'Unknown posts' });
    }

    try {
      const added = await prisma.$transaction(async (tx) => {
        await touchPool(tx, id);

        const existing = await tx.poolPost.findMany({
          where: { poolId: id, postId: { in: postIds } },
          select: { postId: true },
        });
        const already = new Set(existing.map((e) => e.postId));
        const toAdd = postIds.filter((postId) => !already.has(postId));
        if (toAdd.length === 0) return [];

        // Enforce max pool item restrictions
        const total = await tx.poolPost.count({ where: { poolId: id } });
        if (total + toAdd.length > MAX_POOL_POSTS) {
          throw new HttpError(400, { error: 'Bad Request', hint: `Pools can hold at most ${MAX_POOL_POSTS} posts` });
        }

        // Append after the current last post (gaps from removals don't matter)
        const { _max } = await tx.poolPost.aggregate({ where: { poolId: id }, _max: { index: true } });
        const start = (_max.index ?? -1) + 1;

        await tx.poolPost.createMany({
          data: toAdd.map((postId, i) => ({ poolId: id, postId, index: start + i })),
        });
        return toAdd;
      });

      return reply.send({ added });
    } catch (e) {
      // A post was deleted between the visibility check and the insert
      if (isMissingRowError(e)) throw new HttpError(400, { error: 'Bad Request', hint: 'Unknown posts' });
      throw e;
    }
  });

  // Remove posts from a pool. Ones not in it are ignored.
  fastify.delete('/:id/posts', {
    onRequest: [fastify.authenticate, requirePermission('pool.manage')],
    schema: { params: idParams, body: postIdsBody },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const { postIds } = req.body as { postIds: number[] };
    const viewer = await getViewer(req);

    await prisma.$transaction(async (tx) => {
      await touchPool(tx, id);

      // Posts the editor can't see stay put, same rule as related posts
      await tx.poolPost.deleteMany({
        where: { poolId: id, postId: { in: postIds }, post: { AND: visibleConditions(viewer) } },
      });
    });

    return reply.status(204).send();
  });

  // Reorder a pool. postIds = every post in the pool YOU can see, in the new order.
  // Posts hidden from you keep their current slots.
  fastify.put('/:id/posts', {
    onRequest: [fastify.authenticate, requirePermission('pool.manage')],
    schema: {
      params: idParams,
      body: {
        type: 'object',
        required: ['postIds'],
        additionalProperties: false,
        properties: {
          postIds: {
            type: 'array',
            maxItems: MAX_POOL_POSTS,
            uniqueItems: true,
            items: { type: 'integer', minimum: 1, maximum: MAX_INT },
          },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const { postIds } = req.body as { postIds: number[] };
    const viewer = await getViewer(req);

    await prisma.$transaction(async (tx) => {
      await touchPool(tx, id);

      const current = await tx.poolPost.findMany({
        where: { poolId: id },
        orderBy: { index: 'asc' },
        select: { postId: true },
      });
      const visibleRows = await tx.poolPost.findMany({
        where: { poolId: id, post: { AND: visibleConditions(viewer) } },
        select: { postId: true },
      });
      const visible = new Set(visibleRows.map((r) => r.postId));

      // Must be exactly the posts you can see: nothing missing, nothing extra
      if (postIds.length !== visible.size || !postIds.every((postId) => visible.has(postId))) {
        throw new HttpError(409, { error: 'Conflict', hint: 'Pool changed since you loaded it, reload and try again' });
      }

      // Walk the current order: hidden posts stay where they are, visible slots take the new order
      let next = 0;
      const order = current.map((row) => (visible.has(row.postId) ? postIds[next++] : row.postId));

      // Rewrite as 0..n-1 (no unique-index juggling needed, and it closes old gaps)
      await tx.poolPost.deleteMany({ where: { poolId: id } });
      await tx.poolPost.createMany({
        data: order.map((postId, index) => ({ poolId: id, postId, index })),
      });
    });

    return reply.status(204).send();
  });
}

export default poolPosts;
