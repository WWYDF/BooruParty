import { boostPost, setFavorite, setVote, undoBoost, VoteValue } from "@/components/posts/interactions";
import { requirePermission, rolePermissionCheck } from "@/core/utilities/permissionCache";
import { postVisibilitySelect } from "@/core/objects/selects/posts";
import { MAX_INT } from "@/core/objects/limits";
import { prisma } from "@/core/plugins/prisma";
import { assertPostVisible, getBrowsingViewer } from "@/core/utilities/viewer";
import { FastifyPluginAsync } from "fastify";
import { getServerSettings } from "@/core/utilities/settingsCache";
import { isMissingRowError } from "@/core/utilities/errors";


const postInteractions: FastifyPluginAsync = async (fastify) => {

  // Set your vote on a post: 1 = like, -1 = dislike, 0 = remove
  fastify.put('/:id/vote', {
    onRequest: [fastify.authenticate, requirePermission('posts.vote')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
      body: {
        type: 'object',
        required: ['value'],
        additionalProperties: false,
        properties: { value: { type: 'integer', enum: [-1, 0, 1] } },
      },
    },
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const { value } = req.body as { value: VoteValue };

    // You can only vote on a post you can see
    const viewer = await getBrowsingViewer(req);
    const post = await prisma.post.findUnique({ where: { id }, select: postVisibilitySelect });
    assertPostVisible(viewer, post);

    try {
      const score = await prisma.$transaction((tx) => setVote(tx, id, req.user.sub, value));
      return reply.send({ score, myVote: value });
    } catch (e) {
      // Post deleted between the visibility check and the write:
      // P2003 = the vote insert hit a missing post, P2025 = the score update found no post
      if (isMissingRowError(e)) { return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' }) };
      throw e;
    }
  });

    // Favorite (true) or unfavorite (false) a post. A new favorite also likes it.
  fastify.put('/:id/favorite', {
    onRequest: [fastify.authenticate, requirePermission('posts.favorite')],
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

    const viewer = await getBrowsingViewer(req);
    const post = await prisma.post.findUnique({ where: { id }, select: postVisibilitySelect });
    assertPostVisible(viewer, post);

    const autoLike = rolePermissionCheck(req.user.roleId, 'posts.vote'); // add setting here too later

    try {
      const result = await prisma.$transaction(async (tx) => {
        const counts = await setFavorite(tx, id, userId, favorited, autoLike);
        const vote = await tx.postVote.findUnique({
          where: { postId_userId: { postId: id, userId } },
          select: { value: true },
        });
        return { ...counts, myVote: vote?.value ?? 0 };
      });

      return reply.status(200).send({ favorited, ...result });
    } catch (e) {
      if (isMissingRowError(e)) { return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' }) };
      throw e;
    }
  });

  // Boost a post (once per cooldown). Returns the new count and the user's cooldown state.
  fastify.put('/:id/boost', {
    onRequest: [fastify.authenticate, requirePermission('posts.boost')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
    },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };

    const viewer = await getBrowsingViewer(req);
    const post = await prisma.post.findUnique({ where: { id }, select: postVisibilitySelect });
    assertPostVisible(viewer, post);

    const cooldown = getServerSettings().boostCooldown;
    try {
      const result = await prisma.$transaction((tx) => boostPost(tx, id, req.user.sub, cooldown));
      return reply.status(200).send(result);
    } catch (e) {
      if (isMissingRowError(e)) { return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' }) };
      throw e;
    }
  });

  // Undo your active boost on this post (only before the cooldown ends). Refunds the cooldown.
  fastify.delete('/:id/boost', {
    onRequest: [fastify.authenticate, requirePermission('posts.boost')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
    },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };

    const viewer = await getBrowsingViewer(req);
    const post = await prisma.post.findUnique({ where: { id }, select: postVisibilitySelect });
    assertPostVisible(viewer, post);

    const cooldown = getServerSettings().boostCooldown;
    try {
      const result = await prisma.$transaction((tx) => undoBoost(tx, id, req.user.sub, cooldown));
      return reply.send(result);
    } catch (e) {
      if (isMissingRowError(e)) { return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' }) };
      throw e;
    }
  });
};

export default postInteractions;