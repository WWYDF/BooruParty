import { MAX_COLLECTION_NAME_LENGTH, MAX_COLLECTIONS_PER_USER } from "@/core/objects/limits";
import { HttpError } from "@/core/utilities/errors";
import { Prisma } from "../../../prisma/client";
import { FastifyPluginAsync } from "fastify";
import { requirePermission } from "@/core/utilities/permissionCache";
import { prisma } from "@/core/plugins/prisma";
import { collectionSummarySelect } from "@/core/objects/selects/summaries";
import { editableCollection } from "@/components/collections/visibility";

type CollectionFields = { name?: string, public?: boolean };

// Shared by create + edit so both enforce identical rules
const collectionFieldSchemas = {
  name: { type: 'string', minLength: 1, maxLength: MAX_COLLECTION_NAME_LENGTH },
  public: { type: 'boolean' },
}

const idParams = {
  type: 'object',
  required: ['id'],
  properties: { id: { type: 'string', format: 'uuid' } },
};

// Trims the name (minLength can't catch " ")
function cleanFields(body: CollectionFields): CollectionFields {
  const data: CollectionFields = {};
  if (body.name !== undefined) {
    data.name = body.name.trim();
    if (!data.name) throw new HttpError(400, { error: 'Bad Request', hint: 'Name cannot be blank' });
  }
  if (body.public !== undefined) data.public = body.public;
  return data;
}

// citext + @@unique([ownerId, name]) -> "Favorites" and "favorites" collide
function isDuplicateName(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}
const DUPLICATE_NAME = { error: 'Conflict', hint: 'You already have a collection with that name' };

const manageCollections: FastifyPluginAsync = async (fastify) => {

  // Create an empty collection
  fastify.post('/', {
    onRequest: [fastify.authenticate, requirePermission('collections.manage.own')],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        additionalProperties: false,
        properties: collectionFieldSchemas,
      },
    },
  }, async (req, reply) => {

    const ownerId = req.user.sub;
    const data = cleanFields(req.body as CollectionFields);

    const owned = await prisma.postCollection.count({ where: { ownerId } });
    if (owned >= MAX_COLLECTIONS_PER_USER) {
      throw new HttpError(403, { error: 'Forbidden', hint: `You can have up to ${MAX_COLLECTIONS_PER_USER} collections` });
    }

    try {
      const collection = await prisma.postCollection.create({
        data: {
          name: data.name!,
          isPublic: data.public,
          ownerId,
        },
        select: collectionSummarySelect,
      });
      return reply.status(201).send(collection);
    } catch (e) {
      if (isDuplicateName(e)) return reply.status(409).send(DUPLICATE_NAME);
      throw e;
    }
  });

  // Rename / change visibility
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: idParams,
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: collectionFieldSchemas,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const where = editableCollection(req.user, id);
    if (!where) throw new HttpError(403, { error: 'Forbidden' });

    const data = cleanFields(req.body as CollectionFields);

    try {
      const { count } = await prisma.postCollection.updateMany({ where, data: { name: data.name, isPublic: data.public, updatedAt: new Date() } });
      if (count === 0) throw new HttpError(404, { error: 'Not found', hint: 'No collection with that id' });
    } catch (e) {
      if (isDuplicateName(e)) return reply.status(409).send(DUPLICATE_NAME);
      throw e;
    }

    return reply.status(204).send();
  });

  // Delete a collection (its posts are obviously untouched and the collection items are cascaded)
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    schema: { params: idParams },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const where = editableCollection(req.user, id);
    if (!where) throw new HttpError(403, { error: 'Forbidden' });

    const { count } = await prisma.postCollection.deleteMany({ where });
    if (count === 0) throw new HttpError(404, { error: 'Not found', hint: 'No collection with that id' });

    return reply.status(204).send();
  });
}

export default manageCollections;