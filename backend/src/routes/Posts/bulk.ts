import { visibleConditions } from "@/components/posts/postQuery";
import { MAX_BULK_EDITS, MAX_INT } from "@/core/objects/limits";
import { prisma } from "@/core/plugins/prisma";
import { getBrowsingViewer, Viewer } from "@/core/utilities/viewer";
import { Safety } from "../../../prisma/client";
import { FastifyPluginAsync } from "fastify";
import { requirePermission, rolePermissionCheck } from "@/core/utilities/permissionCache";
import { recountFavorites, recountScores, VoteValue } from "@/components/posts/interactions";
import { isMissingRowError } from "@/core/utilities/errors";
import { cleanupDeletedPosts, deletePosts, postDeleteSelect } from "@/components/posts/delete";


// Every bulk route takes the selected posts in the same shape
const postIdsSchema = {
  type: 'array', minItems: 1, maxItems: MAX_BULK_EDITS, uniqueItems: true,
  items: { type: 'integer', minimum: 1, maximum: MAX_INT },
} as const;

// Which of these ids the viewer can see. (All safeties, not their browsing preference)
// They selected these posts from a search, so a rating outside their default doesn't hide them from this
async function visibleIds(viewer: Viewer, postIds: number[]): Promise<number[]> {
  const rows = await prisma.post.findMany({
    where: { AND: [{ id: { in: postIds } }, ...visibleConditions(viewer, Object.values(Safety))] },
    select: { id: true },
  });
  return rows.map((p) => p.id);
}

const bulkPosts: FastifyPluginAsync = async (fastify) => {

  // Same as PUT /posts/:id/vote, for many posts at once
  fastify.put('/vote', {
    onRequest: [fastify.authenticate, requirePermission('posts.vote')],
    schema: {
      body: {
        type: 'object',
        required: ['postIds', 'value'],
        additionalProperties: false,
        properties: {
          postIds: postIdsSchema,
          value: { type: 'integer', enum: [-1, 0, 1] },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { postIds, value } = req.body as { postIds: number[], value: VoteValue };
    const userId = req.user.sub;

    const viewer = await getBrowsingViewer(req);
    const ids = await visibleIds(viewer, postIds);
    const skipped = postIds.filter((id) => !ids.includes(id)); // hidden or missing, same as 404

    if (ids.length) {
      try {
        await prisma.$transaction(async (tx) => {
          if (value === 0) {
            await tx.postVote.deleteMany({ where: { userId, postId: { in: ids } } });
          } else {
            await tx.postVote.updateMany({ where: { userId, postId: { in: ids }, value: { not: value } }, data: { value } });
            await tx.postVote.createMany({ data: ids.map((postId) => ({ postId, userId, value })), skipDuplicates: true });
          }
          await recountScores(tx, ids);
        });
      } catch (e) {
        // A post was deleted between the visibility check and the insert
        if (isMissingRowError(e)) return reply.status(409).send({ error: 'Conflict', hint: 'Some posts were deleted mid-request. Please retry.' });
        throw e;
      }
    }

    return reply.status(200).send({ updated: ids, skipped });
  });

  // Same as PUT /posts/:id/favorite, for many posts at once. New favorites also like the post.
  fastify.put('/favorite', {
    onRequest: [fastify.authenticate, requirePermission('posts.favorite')],
    schema: {
      body: {
        type: 'object',
        required: ['postIds', 'favorited'],
        additionalProperties: false,
        properties: {
          postIds: postIdsSchema,
          favorited: { type: 'boolean' },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { postIds, favorited } = req.body as { postIds: number[], favorited: boolean };
    const userId = req.user.sub;

    const viewer = await getBrowsingViewer(req);
    const ids = await visibleIds(viewer, postIds);
    const skipped = postIds.filter((id) => !ids.includes(id));

    const autoLike = rolePermissionCheck(req.user.roleId, 'posts.vote');

    if (ids.length) {
      try {
        await prisma.$transaction(async (tx) => {
          if (favorited) {
            // Only posts that weren't already favorited get the auto-like (same as the single route)
            const existing = await tx.postFavorite.findMany({
              where: { userId, postId: { in: ids } },
              select: { postId: true },
            });
            const had = new Set(existing.map((f) => f.postId));
            const newIds = ids.filter((id) => !had.has(id));

            if (newIds.length) {
              await tx.postFavorite.createMany({ data: newIds.map((postId) => ({ postId, userId })), skipDuplicates: true });

              if (autoLike) {
                await tx.postVote.updateMany({ where: { userId, postId: { in: newIds }, value: { not: 1 } }, data: { value: 1 } });
                await tx.postVote.createMany({ data: newIds.map((postId) => ({ postId, userId, value: 1 })), skipDuplicates: true });
                await recountScores(tx, newIds);
              }
            }
          } else {
            // Unfavoriting leaves votes alone
            await tx.postFavorite.deleteMany({ where: { userId, postId: { in: ids } } });
          }

          await recountFavorites(tx, ids);
        });
      } catch (e) {
        if (isMissingRowError(e)) return reply.status(409).send({ error: 'Conflict', hint: 'Some posts were deleted mid-request. Please retry.' });
        throw e;
      }
    }

    return reply.status(200).send({ updated: ids, skipped });
  });

  // Same as DELETE /posts/:id, for many posts at once.
  // Posts you can't delete (not yours without delete.others, or missing) are skipped, not a 403
  fastify.delete('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['postIds'],
        additionalProperties: false,
        properties: { postIds: postIdsSchema },
      },
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { postIds } = req.body as { postIds: number[] };
    const userId = req.user.sub;

    const canOthers = rolePermissionCheck(req.user.roleId, 'posts.delete.others');
    const canOwn = rolePermissionCheck(req.user.roleId, 'posts.delete.own');

    // No delete perms at all: nothing in the batch could succeed, so say so instead of "skipped all"
    if (!canOthers && !canOwn) {
      return reply.status(403).send({ error: 'Forbidden', hint: 'Missing permission: posts.delete.own' });
    }

    // Same rule as the single route, per post: delete.others covers your own posts too
    const posts = await prisma.post.findMany({ where: { id: { in: postIds } }, select: postDeleteSelect });
    const allowed = posts.filter((p) => canOthers || p.uploaderId === userId);

    let deleted: number[] = [];
    if (allowed.length) {
      deleted = await prisma.$transaction((tx) => deletePosts(tx, allowed.map((p) => p.id)));
      await cleanupDeletedPosts(allowed.filter((p) => deleted.includes(p.id)));
    }

    const skipped = postIds.filter((id) => !deleted.includes(id));
    return reply.status(200).send({ updated: deleted, skipped });
  });
}

export default bulkPosts;