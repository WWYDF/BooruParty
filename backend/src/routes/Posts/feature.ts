import { prisma } from "@/core/plugins/prisma";
import { requirePermission } from "@/core/utilities/permissionCache";
import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";
import { getServerSettings, loadServerSettings } from "@/core/utilities/settingsCache";
import { getViewer } from "@/core/utilities/viewer";
import { listedConditions } from "@/components/posts/postQuery";
import { postSummarySelect } from "@/core/objects/selects/summaries";
import { formatPostSummary } from "@/core/utilities/reformatters";

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'integer', minimum: 1 } },
} as const;

const featurePosts: FastifyPluginAsync = async (fastify) => {

  // Get featured post
  fastify.get('/featured', {
    onRequest: [fastify.authenticate],
  }, async (req, reply) => {
    const viewer = await getViewer(req);
    if (!viewer.canView) {
      return viewer.userId
        ? reply.status(403).send({ error: 'Forbidden', hint: 'Missing permission: posts.view' })
        : reply.status(401).send({ error: 'Unauthorized', hint: 'Log in to view posts' });
    }

    const { featuredPostId } = getServerSettings();
    if (featuredPostId === null) return reply.status(200).send({ post: null });

    // Same visibility rules as the feed (A guest never gets an explicit or private featured post)
    const post = await prisma.post.findFirst({
      where: { AND: [{ id: featuredPostId }, ...listedConditions(viewer)] },
      select: postSummarySelect,
    });

    return reply.status(200).send({ post: post ? formatPostSummary(post) : null });
  });

  // Feature this post (replaces current feature)
  fastify.put('/:id/feature', {
    onRequest: [fastify.authenticate, requirePermission('posts.feature')],
    schema: { params: idParams },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };

    try {
      await prisma.serverSettings.update({ where: { id: 1 }, data: { featuredPostId: id } });
    } catch (e) {
      // foreign key failed: no post with that id
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });
      }
      throw e;
    }

    await loadServerSettings();
    return reply.status(204).send();
  });

  // Unfeature this post
  fastify.delete('/:id/feature', {
    onRequest: [fastify.authenticate, requirePermission('posts.feature')],
    schema: { params: idParams },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };

    const { count } = await prisma.serverSettings.updateMany({
      where: { id: 1, featuredPostId: id },
      data: { featuredPostId: null }
    });

    if (count) await loadServerSettings();
    return reply.status(204).send();
  });
}

export default featurePosts;