import { MAX_COLLECTION_BATCH, MAX_COLLECTION_POSTS, MAX_INT } from "@/core/objects/limits";
import { Prisma } from "../../../prisma/client";
import { HttpError, isMissingRowError } from "@/core/utilities/errors";
import { FastifyPluginAsync } from "fastify";
import { editableCollection } from "@/components/collections/visibility";
import { getViewer } from "@/core/utilities/viewer";
import { prisma } from "@/core/plugins/prisma";
import { visibleConditions } from "@/components/posts/postQuery";


const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

const postIdsBody = {
  type: 'object',
  required: ['postIds'],
  additionalProperties: false,
  properties: {
    postIds: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_COLLECTION_BATCH,
      uniqueItems: true,
      items: { type: 'integer', minimum: 1, maximum: MAX_INT },
    },
  },
};

// Bumps updatedAt AND locks the collection row until transaction finalizes
// 404 if its gone or isnt yours
async function touchCollectionsPP(tx: Prisma.TransactionClient, where: Prisma.PostCollectionWhereInput) {
  const { count } = await tx.postCollection.updateMany({ where, data: { updatedAt: new Date() } });
  if (count === 0) throw new HttpError(404, { error: 'Not found', hint: 'No collection with that id' });
}

const postCollections: FastifyPluginAsync = async (fastify) => {

  // Add posts. Ones already in it are skipped over.
  fastify.post('/:id/posts', {
    onRequest: [fastify.authenticate],
    schema: { params: idParams, body: postIdsBody },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { postIds } = req.body as { postIds: number[] };
    const where = editableCollection(req.user, id);
    if (!where) throw new HttpError(403, { error: 'Forbidden' });

    // You can only add posts you can see. Hidden and nonexistent give the same answer
    const viewer = await getViewer(req);
    const visible = await prisma.post.count({
      where: { AND: [{ id: { in: postIds } }, ...visibleConditions(viewer)] },
    });
    if (visible !== postIds.length) {
      throw new HttpError(400, { error: 'Bad Request', hint: 'Unknown posts' });
    }

    try {
      const added = await prisma.$transaction(async (tx) => {
        await touchCollectionsPP(tx, where);

        const { count } = await tx.postCollectionItem.createMany({
          data: postIds.map((postId) => ({ collectionId: id, postId })),
          skipDuplicates: true,
        });
        if (count === 0) return 0;

        // Count after the insert (throwing rolls the insert back)
        const { itemCount } = await tx.postCollection.update({
          where: { id },
          data: { itemCount: { increment: count } },
          select: { itemCount: true }
        });
        if (itemCount > MAX_COLLECTION_POSTS) {
          throw new HttpError(400, { error: 'Bad Request', hint: `Collections can hold at most ${MAX_COLLECTION_POSTS} posts` });
        }
        return count;
      });

      return reply.code(201).send({ added });
    } catch (e) {
      // A post was deleted between the visibility check and the insert
      if (isMissingRowError(e)) throw new HttpError(400, { error: 'Bad Request', hint: 'Unknown posts' });
      throw e;
    }
  });

  // Remove posts. Ones not in it are ignored.
  fastify.delete('/:id/posts', {
    onRequest: [fastify.authenticate],
    schema: { params: idParams, body: postIdsBody },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { postIds } = req.body as { postIds: number[] };
    const where = editableCollection(req.user, id);
    if (!where) throw new HttpError(403, { error: 'Forbidden' });

    await prisma.$transaction(async (tx) => {
      await touchCollectionsPP(tx, where);

      const { count } = await tx.postCollectionItem.deleteMany({
        where: { collectionId: id, postId: { in: postIds } },
      });
      if (count > 0) {
        await tx.postCollection.update({ where: { id }, data: { itemCount: { decrement: count } } });
      }
    });

    return reply.status(204).send();
  });
}

export default postCollections;