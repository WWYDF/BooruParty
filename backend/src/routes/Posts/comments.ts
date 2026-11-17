import { assertEmbedsAllowed, parseEmbeds, resolveEmbeddedPosts } from "@/components/posts/comments";
import { MAX_COMMENT_LENGTH, MAX_INT } from "@/core/objects/limits";
import { commentSelect } from "@/core/objects/selects/comments";
import { postVisibilitySelect } from "@/core/objects/selects/posts";
import { prisma } from "@/core/plugins/prisma";
import { requirePermission } from "@/core/utilities/permissionCache";
import { assertPostVisible, getBrowsingViewer } from "@/core/utilities/viewer";
import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";

const postComments: FastifyPluginAsync = async (fastify) => {

  // a post's comments, newest first, cursor paginated by comment id
  fastify.get('/:id/comments', {
    onRequest: [fastify.identify],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          cursor: { type: 'integer', minimum: 1, maximum: MAX_INT }, // id of the last comment from the previous page
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 30 },
        },
      },
    }
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const { cursor, limit } = req.query as { cursor?: number, limit: number };

    const viewer = await getBrowsingViewer(req);

    // A hidden post's comments are as hidden as the post
    const post = await prisma.post.findUnique({ where: { id }, select: postVisibilitySelect });
    assertPostVisible(viewer, post); // automatically replies with 404 if not visible

    const rows = await prisma.postComment.findMany({
      where: { postId: id, ...(cursor ? { id: { lt: cursor } } : {}) },
      orderBy: { id: 'desc' },
      take: limit + 1, // one extra tells us there is another page
      select: commentSelect
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    // Each comment carries its own parsed embeds, so the UI never needs the media allowlist
    const comments = page.map((c) => ({ ...c, embeds: parseEmbeds(c.content) }));

    const embeddedPosts = await resolveEmbeddedPosts(comments.flatMap((c) => c.embeds.postIds), viewer);
    
    return reply.status(200).send({
      nextCursor: hasMore ? page[page.length - 1].id : null,
      comments,
      embeddedPosts,
    });
  });

  fastify.post('/:id/comments', {
    onRequest: [fastify.authenticate, requirePermission('comment.create')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
      body: {
        type: 'object',
        required: ['content'],
        additionalProperties: false,
        properties: { content: { type: 'string', minLength: 1, maxLength: MAX_COMMENT_LENGTH } },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const content = (req.body as { content: string }).content.trim();
    if (!content) return reply.status(400).send({ error: 'Empty comment', hint: 'Write something first' });
  
    // You can only comment on a post you can see lol
    const viewer = await getBrowsingViewer(req);
    const post = await prisma.post.findUnique({ where: { id }, select: postVisibilitySelect });
    assertPostVisible(viewer, post); // automatically replies with 404 if not visible

    const embeds = parseEmbeds(content);
    assertEmbedsAllowed(embeds, req.user.roleId);

    try {
      const comment = await prisma.postComment.create({
        data: { postId: id, authorId: req.user.sub, content },
        select: commentSelect,
      });

      return reply.status(201).send({
        comment: { ...comment, embeds },
        embeddedPosts: await resolveEmbeddedPosts(embeds.postIds, viewer),
      })
    } catch (e) {
      // The post was deleted between the visibility check and the insert
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });
      }
      throw e;
    }
  });
}

export default postComments;