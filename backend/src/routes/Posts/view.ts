import { buildPostQuery, cursorCondition, encodeCursor, reverseOrder, visibleConditions } from "@/components/posts/postQuery";
import { postDetailSelect } from "@/core/objects/selects/posts";
import { postSummarySelect } from "@/core/objects/selects/summaries";
import { prisma } from "@/core/plugins/prisma";
import { formatPostDetail, formatPostSummary } from "@/core/utilities/reformatters";
import { parseSearch } from "@/core/utilities/search";
import { getServerSettings } from "@/core/utilities/settingsCache";
import { getViewer, isHiddenFrom, Viewer } from "@/core/utilities/viewer";
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
    if (!post || isHiddenFrom(viewer, post)) {
      return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });
    }

    // Related Posts (this post can be on either side of a stored pair)
    const relations = await prisma.postRelation.findMany({
      where: { OR: [{ fromId: id }, { toId: id }] },
      select: { fromId: true, toId: true },
      orderBy: { createdAt: 'asc' },
    });
    const relatedIds = relations.map((r) => (r.fromId === id ? r.toId : r.fromId));

    // Same visibility rules as the feed (Hidden posts are left out)
    const relatedRows = relatedIds.length
      ? await prisma.post.findMany({
          where: { AND: [{ id: { in: relatedIds } }, ...visibleConditions(viewer)] },
          select: postSummarySelect,
        })
      : [];
    
    // findMany doesnt keep the "in" order.
    // Reorder them in the order they were linkedin.com
    const byId = new Map(relatedRows.map((r) => [r.id, r]));
    const related = relatedIds.flatMap((rid) => {
      const row = byId.get(rid);
      return row ? [formatPostSummary(row)] : [];
    });

    return reply.status(200).send({
      ...formatPostDetail(post),
      related,
      featured: getServerSettings().featuredPostId === id,
    });
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

  fastify.get('/:id/navigate', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1 } },
      },
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: { q: { type: 'string', maxLength: 1024, default: '' } },
      },
    },
    config: { rateLimit: { max: 60, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const { q } = req.query as { q: string };

    const viewer = await getViewer(req);
    if (!viewer.canView) {
      return viewer.userId
        ? reply.status(403).send({ error: 'Forbidden', hint: 'Missing permission: posts.view' })
        : reply.status(401).send({ error: 'Unauthorized', hint: 'Log in to view posts' });
    }

    // Only the sort values are needed (plus what isHiddenFrom checks)
    const current = await prisma.post.findUnique({
      where: { id },
      select: { id: true, score: true, safety: true, uploader: { select: { id: true, private: true } } },
    });
    if (!current || isHiddenFrom(viewer, current)) {
      return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });
    }

    const none = { previewPostId: null, nextPostId: null };

    const parsed = parseSearch(q);
    if (parsed.errors.length) {
      return reply.status(400).send({ error: 'Invalid search parameters', hint: parsed.errors.join(' '), errors: parsed.errors });
    }
    if (parsed.order === 'random') return reply.status(200).send(none); // no fixed order to step through, may fetch a new random post later

    const query = await buildPostQuery(parsed, viewer);
    if (query.empty) return reply.status(200).send(none);

    const cursor = encodeCursor(parsed.order, current);
    const [up, down] = await Promise.all([
      // Closest post ABOVE this one in the feed (reverse the order and take the first)
      prisma.post.findFirst({
        where: { AND: [query.where, cursorCondition(parsed.order, cursor, 'before')!] },
        orderBy: reverseOrder(query.orderBy),
        select: { id: true },
      }),

      // Cloest post BELOW this one in the feed (feed's own order, first row after cursor)
      prisma.post.findFirst({
        where: { AND: [query.where, cursorCondition(parsed.order, cursor)!] },
        orderBy: query.orderBy,
        select: { id: true },
      }),
    ]);

    // Next = up the feed (newer in default order), Previous = down it
    return reply.status(200).send({ nextPostId: up?.id ?? null, previousPostId: down?.id ?? null });
  });
}

export default viewPosts;