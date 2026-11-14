import { appLogger } from "@/core/plugins/logger";
import { prisma } from "@/core/plugins/prisma";
import { requirePermission } from "@/core/utilities/permissionCache";
import { normalizeTagName } from "@/core/utilities/tags";
import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";

const logger = appLogger('Tags');

// Loose limits here, normalizeTagName() enforces real values
const tagNameInputSchema = { type: 'string', minLength: 1, maxLength: 128 } as const;
const tagDescriptionSchema = { type: 'string', maxLength: 4096 } as const;

const tags: FastifyPluginAsync = async (fastify) => {

  // Create a tag
  fastify.post('/', {
    onRequest: [fastify.authenticate, requirePermission('tags.create')],
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name'],
        properties: {
          name: tagNameInputSchema,
          categoryId: { type: 'integer', minimum: 1 },
          description: tagDescriptionSchema,
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as {
      name: string,
      categoryId?: number,
      description?: string,
    };

    const normalized = normalizeTagName(body.name);
    if (!normalized.ok) return reply.status(400).send({ error: 'Invalid tag name', hint: normalized.reason });
    const name = normalized.name;

    // No category given -> use default category
    let categoryId = body.categoryId;
    if (categoryId === undefined) {
      const fallback = await prisma.tagCategory.findFirst({ where: { isDefault: true }, select: { id: true } });
      if (!fallback) {
        logger.error('No default tag category exists');
        return reply.status(500).send({ error: 'Something went wrong' });
      }
      categoryId = fallback.id
    }

    try {
      const tag = await prisma.tag.create({
        data: {
          name,
          categoryId,
          description: body.description?.trim() || null,
          names: { create: { name } }, // the primary name's TagName row, written in the same statement
        },
        include: { category: true, names: { select: { name: true } } },
      });

      return reply.status(201).send(tag);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        // Name already taken, either as a tag or as an alias
        if (e.code === 'P2002') {
          const owner = await prisma.tagName.findUnique({
            where: { name },
            select: { tag: { select: { name: true } } },
          });
          const hint = owner && owner.tag.name !== name
            ? `"${name}" is already an alias of "${owner.tag.name}"`
            : `"${name}" already exists`;
          return reply.status(409).send({ error: 'Tag already exists', hint });
        }
        // categoryId points at nothing
        if (e.code === 'P2003') return reply.status(400).send({ error: 'Incorrect body', hint: 'Category does not exist' });
      }
      logger.error('Failed to create tag', e);
      return reply.status(500).send({ error: 'Something went wrong' });
    }
  });
}

export default tags;