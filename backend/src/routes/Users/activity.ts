import { FastifyPluginAsync } from "fastify";
import { listedConditions } from "@/components/posts/postQuery";
import { parseEmbeds, resolveEmbeddedPosts } from "@/components/posts/comments";
import { MAX_INT } from "@/core/objects/limits";
import { commentSelect } from "@/core/objects/selects/comments";
import { postSummarySelect } from "@/core/objects/selects/summaries";
import { prisma } from "@/core/plugins/prisma";
import { HttpError } from "@/core/utilities/errors";
import { formatPostSummary, formatUserSummary } from "@/core/utilities/reformatters";
import { getBrowsingViewer } from "@/core/utilities/viewer";

const userActivity: FastifyPluginAsync = async (fastify) => {

  // A user's comments, newest first. Only comments on posts YOU would see listed (safety, private uploaders, your blacklist).
  fastify.get('/:username/comments', {
    onRequest: [fastify.identify],
    schema: {
      params: { type: 'object', required: ['username'], properties: { username: { type: 'string', maxLength: 32 } } },
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
          cursor: { type: 'integer', minimum: 1, maximum: MAX_INT }, // last comment id of the previous page
        },
      },
    },
  }, async (req, reply) => {
    const { username } = req.params as { username: string };
    const { limit, cursor } = req.query as { limit: number, cursor?: number };
    const viewer = await getBrowsingViewer(req); // comments show posts, so the usual "can browse" rules apply

    const user = await prisma.user.findFirst({ where: { username, id: { not: '0' } }, select: { id: true, private: true } });
    if (!user) throw new HttpError(404, { error: 'Not found', hint: 'No user with that username' });

    // Private accounts: activity is only for the owner + admins (same rule as likes:/favorites: and favorite tags)
    if (user.private && viewer.userId !== user.id && !viewer.canSeePrivate) {
      return reply.send({ comments: [], nextCursor: null, embeddedPosts: {} });
    }

    const rows = await prisma.postComment.findMany({
      where: {
        authorId: user.id,
        ...(cursor && { id: { lt: cursor } }),
        post: { AND: listedConditions(viewer) },
      },
      orderBy: { id: 'desc' },
      take: limit + 1, // one extra tells us if there's another page
      select: { ...commentSelect, post: { select: postSummarySelect } },
    });

    const page = rows.slice(0, limit);
    const comments = page.map(({ post, ...c }) => ({
      ...c,
      author: formatUserSummary(c.author),
      embeds: parseEmbeds(c.content),
      post: formatPostSummary(post), // which post it's on: thumbnail + link for the profile list
    }));

    const embedIds = [...new Set(comments.flatMap((c) => c.embeds.postIds))];
    return reply.send({
      nextCursor: rows.length > limit ? page[page.length - 1].id : null,
      embeddedPosts: await resolveEmbeddedPosts(embedIds, viewer),
      comments,
    });
  });
};

export default userActivity;
