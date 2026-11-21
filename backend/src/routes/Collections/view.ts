import { CollectionSummary, collectionSummarySelect, postSummarySelect } from "@/core/objects/selects/summaries";
import { Prisma } from "../../../prisma/client";
import { getBrowsingViewer, Viewer } from "@/core/utilities/viewer";
import { listedConditions } from "@/components/posts/postQuery";
import { prisma } from "@/core/plugins/prisma";
import { formatPostSummary } from "@/core/utilities/reformatters";
import { FastifyPluginAsync } from "fastify";
import { MAX_INT } from "@/core/objects/limits";
import { HttpError } from "@/core/utilities/errors";
import { visibleCollection } from "@/components/collections/visibility";

const COLLECTION_SORTS = ['updated', 'newest', 'name', 'size'] as const;
type CollectionSort = typeof COLLECTION_SORTS[number];

// Every order ends on id so pages never shuffle when values tie
const COLLECTION_ORDER: Record<CollectionSort, Prisma.PostCollectionOrderByWithRelationInput[]> = {
  updated: [{ updatedAt: 'desc' }, { id: 'desc' }],
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  name: [{ name: 'asc' }, { id: 'asc' }],
  size: [{ itemCount: 'desc' }, { id: 'desc' }],
}

// Cover is the most recently added post THIS viewer can see. One indexed lookup per collection
async function withCovers(collections: CollectionSummary[], viewer: Viewer) {
  const visible = listedConditions(viewer);
  const covers = await Promise.all(collections.map((c) =>
    prisma.postCollectionItem.findFirst({
      where: { collectionId: c.id, post: { AND: visible } },
      orderBy: { addedAt: 'desc' },
      select: { post: { select: postSummarySelect } },
    })
  ));

  return collections.map((c, i) => ({
    ...c,
    cover: covers[i] ? formatPostSummary(covers[i].post) : null,
  }));
}

const viewCollections: FastifyPluginAsync = async (fastify) => {

  // List a user's collections. Private ones only show up for their owner.
  fastify.get('/', {
    onRequest: [fastify.identify],
    schema: {
      querystring: {
        type: 'object',
        required: ['owner'],
        properties: {
          owner: { type: 'string', minLength: 1 },
          sort: { type: 'string', enum: COLLECTION_SORTS, default: 'updated' },
          page: { type: 'integer', minimum: 1, maximum: MAX_INT, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 24 },
        },
      },
    },
  }, async (req, reply) => {
    const { owner, sort, page, limit } = req.query as { owner: string, sort: CollectionSort, page: number, limit: number };
    const viewer = await getBrowsingViewer(req);
  
    const user = await prisma.user.findUnique({ where: { username: owner }, select: { id: true } });
    if (!user) throw new HttpError(404, { error: 'Not found', hint: 'No user with that name' });

    const where: Prisma.PostCollectionWhereInput = { AND: [{ ownerId: user.id }, visibleCollection(viewer)] };
    const [collections, total] = await prisma.$transaction([
      prisma.postCollection.findMany({
        where,
        orderBy: COLLECTION_ORDER[sort],
        skip: (page - 1) * limit,
        take: limit,
        select: collectionSummarySelect,
      }),
      prisma.postCollection.count({ where }),
    ]);

    return reply.status(200).send({
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      collections: await withCovers(collections, viewer),
    });
  });

  // Your own collections, for the "add to collection" popup.
  // With ?postId, each one says whether that post is already in it.
  fastify.get('/own', {
    onRequest: [fastify.authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: { postId: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
    },
  }, async (req, reply) => {
    const { postId } = req.query as { postId?: number };

    const collections = await prisma.postCollection.findMany({
      where: { ownerId: req.user.sub },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], // recently used first
      select: {
        ...collectionSummarySelect,
        ...(postId !== undefined && { _count: { select: { items: { where: { postId } } } } }),
      },
    });

    return reply.send({
      collections: collections.map(({ _count, ...c }) => ({
        ...c,
        ...(postId !== undefined && { hasPost: (_count?.items ?? 0) > 0 }),
      })),
    });
  });
}

export default viewCollections;