import { parseEmbeds } from "@/components/posts/comments";
import { visibleConditions } from "@/components/posts/postQuery";
import { MAX_INT } from "@/core/objects/limits";
import { commentSelect } from "@/core/objects/selects/comments";
import { postSummarySelect } from "@/core/objects/selects/summaries";
import { prisma } from "@/core/plugins/prisma";
import { formatPostSummary } from "@/core/utilities/reformatters";
import { assertPostVisible, getBrowsingViewer, getViewer, isHiddenFrom, postVisibilitySelect } from "@/core/utilities/viewer";
import { FastifyPluginAsync } from "fastify";

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

    // Every embedded post on this page in ONE query. Posts this viewer can't see are absent
    const embeddedIds = [...new Set(comments.flatMap((c) => c.embeds.postIds))];
    const embedded = embeddedIds.length
      ? await prisma.post.findMany({
          where: { AND: [{ id: { in: embeddedIds } }, ...visibleConditions(viewer)] },
          select: postSummarySelect,
        })
      : [];
    
      return reply.status(200).send({
        nextCursor: hasMore ? page[page.length - 1].id : null,
        comments,
        embeddedPosts: Object.fromEntries(embedded.map((p) => [p.id, formatPostSummary(p)])),
      });
  })
}

export default postComments;