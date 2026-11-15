import { buildPostQuery, cursorCondition, encodeCursor } from "@/components/posts/postQuery";
import { postDetailSelect } from "@/core/objects/selects/posts";
import { postSummarySelect } from "@/core/objects/selects/summaries";
import { prisma } from "@/core/plugins/prisma";
import { formatPostDetail, formatPostSummary } from "@/core/utilities/reformatters";
import { parseSearch } from "@/core/utilities/search";
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

    // Hidden posts look the same as missing ones
    const hiddenBySafety  = post && viewer.safetyIsCap && !viewer.safety.includes(post.safety);
    const hiddenByPrivacy = post && post.uploader.private && !viewer.canSeePrivate && post.uploader.id !== viewer.userId;

    // Guests are capped by guestSafety. A hidden post looks the same as a missing one.
    if (!post || hiddenBySafety || hiddenByPrivacy) {
      return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });
    }

    return reply.status(200).send(formatPostDetail(post));
  });

  // Feed / Search
  fastify.get('/', {
    onRequest: [fastify.identify],
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string', maxLength: 1024, default: '' },
          cursor: { type: 'string', maxLength: 32 },
          limit: { type: 'integer', minimum: 1, maximum: 150, default: 75 },
        },
      },
    },
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { q, cursor, limit } = req.query as { q: string, cursor?: string, limit: number };
    
    const viewer = await getViewer(req);
    if (!viewer.canView) {
      return viewer.userId
        ? reply.status(403).send({ error: 'Forbidden', hint: 'Missing permission: posts.view' })
        : reply.status(401).send({ error: 'Unauthorized', hint: 'Log in to view posts' });
    }

    const parsed = parseSearch(q);
    if (parsed.errors.length) {
      return reply.status(400).send({ error: 'Invalid search parameters', hint: parsed.errors.join(' '), errors: parsed.errors });
    }

    const query = await buildPostQuery(parsed, viewer);
    if (query.empty) {
      return reply.status(200).send({ posts: [], nextCursor: null, total: 0, unknownTags: query.unknownTags });
    }

    // Random: sample from every match, no pagination ("next page" = another random batch)
    if (query.random) {
      const ids = (await prisma.post.findMany({ where: query.where, select: { id: true } })).map((r) => r.id);

      // Partial Fisher-Yates: shuffle only the first `limit` slots
      for (let i = 0; i < Math.min(limit, ids.length); i++) {
        const j = i + Math.floor(Math.random() * (ids.length - i));
        [ids[i], ids[j]] = [ids[j], ids[i]];
      }
      const picked = ids.slice(0, limit);

      const rows = await prisma.post.findMany({ where: { id: { in: picked } }, select: postSummarySelect });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const posts = picked.map((id) => byId.get(id)).filter(Boolean).map((p) => formatPostSummary(p!));

      return reply.status(200).send({ posts, nextCursor: null, total: ids.length, unknownTags: query.unknownTags });
    }

    // Normal: keyset pagination
    const AND = [query.where];
    if (cursor) {
      const after = cursorCondition(parsed.order, cursor);
      if (!after) return reply.status(400).send({ error: 'Invalid cursor' });
      AND.push(after);
    }

    const [rows, total] = await Promise.all([
      prisma.post.findMany({
        where: { AND },
        orderBy: query.orderBy,
        select: postSummarySelect,
        take: limit + 1,
      }),
      cursor ? Promise.resolve(null) : prisma.post.count({ where: query.where }),
    ]);

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    return reply.status(200).send({
      nextCursor: hasMore ? encodeCursor(parsed.order, page[page.length -1]) : null,
      total, // first page only, null afterwards
      unknownTags: query.unknownTags,
      posts: page.map(formatPostSummary),
    });
  });
}

export default viewPosts;