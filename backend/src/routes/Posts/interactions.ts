import { setVote, VoteValue } from "@/components/posts/votes";
import { requirePermission } from "@/core/utilities/permissionCache";
import { postVisibilitySelect } from "@/core/objects/selects/posts";
import { MAX_INT } from "@/core/objects/limits";
import { prisma } from "@/core/plugins/prisma";
import { assertPostVisible, getBrowsingViewer } from "@/core/utilities/viewer";
import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";


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
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2003' || e.code === 'P2025')) {
        return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });
      }
      throw e;
    }
  });
};

export default postInteractions;