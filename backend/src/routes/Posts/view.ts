import { postDetailSelect } from "@/core/objects/selects/posts";
import { prisma } from "@/core/plugins/prisma";
import { formatPostDetail } from "@/core/utilities/reformatters";
import { getViewer } from "@/core/utilities/viewer";
import { FastifyPluginAsync } from "fastify";

const viewPosts: FastifyPluginAsync = async (fastify) => {
  
  // View a single post
  fastify.get('/:id', {
    onRequest: [fastify.identify],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1 } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };

    const viewer = await getViewer(req);
    if (!viewer.canView) {
      return viewer.userId
        ? reply.status(403).send({ error: 'Forbidden', hint: "Missing permission: posts.view" })
        : reply.status(401).send({ error: 'Unauthorized', hint: "Log in to view posts" });
    }

    const post = await prisma.post.findUnique({ where: { id }, select: postDetailSelect });

    // Guests are capped by guestSafety. A hidden post looks the same as a missing one.
    if (!post || (viewer.safetyIsCap && !viewer.safety.includes(post.safety))) {
      return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });
    }

    return reply.status(200).send(formatPostDetail(post));
  });
}

export default viewPosts;