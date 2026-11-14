import { appLogger } from "@/core/plugins/logger";
import { prisma } from "@/core/plugins/prisma";
import { requirePermission } from "@/core/utilities/permissionCache";
import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";
import { hexColorSchema } from "@/core/objects/fastifySchemas";

const logger = appLogger('Tags/Categories');

const categoryNameSchema = { type: 'string', minLength: 1, maxLength: 32 } as const;

const tagCategories: FastifyPluginAsync = async (fastify) => {
  const canManage = [fastify.authenticate, requirePermission('tags.categories.manage')];

  // List all categories (public: UI needs these to color tags)
  fastify.get('/', async (req, reply) => {
    const categories = await prisma.tagCategory.findMany({
      orderBy: { index: 'asc' },
      include: { _count: { select: { tags: true } } },
    });

    return reply.status(200).send(categories);
  })

  fastify.post('/', {
    onRequest: canManage,
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'color'],
        properties: {
          name: categoryNameSchema,
          color: hexColorSchema,
          index: { type: 'integer', minimum: 0 },
          isDefault: { type: 'boolean' },
        },
      }
    }
  }, async (req, reply) => {
    const body = req.body as {
      name: string,
      color: string,
      index?: number,
      isDefault?: boolean,
    };

    const name = body.name.trim();
    if (!name) return reply.status(400).send({ error: 'Incorrect body', hint: 'Category name is empty' });

    try {
      const category = await prisma.$transaction(async (tx) => {
        // Only one default at a time
        if (body.isDefault) {
          await tx.tagCategory.updateMany({
            where: { isDefault: true },
            data: { isDefault: false }
          })
        }

        // No index given -> put it at the end
        let index = body.index;
        if (index === undefined) {
          const last = await tx.tagCategory.aggregate({ _max: { index: true } });
          index = (last._max.index ?? -1) + 1;
        }

        return tx.tagCategory.create({
          data: {
            name,
            color: body.color.toLowerCase(),
            index,
            isDefault: body.isDefault ?? false
          }
        });
      })

      return reply.status(201).send(category);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return reply.status(409).send({ error: 'A category with that name already exists' });
      }
      logger.error('Failed to create category', e);
      return reply.status(500).send({ error: 'Something went wrong' });
    }
  })

  fastify.patch('/:id', {
    onRequest: canManage,
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1 } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          name: categoryNameSchema,
          color: hexColorSchema,
          index: { type: 'integer', minimum: 0 },
          isDefault: { type: 'boolean', const: true }, // you can only BECOME default (i.e. cannot PATCH it to false)
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const body = req.body as {
      name?: string,
      color?: string,
      index?: number,
      isDefault?: true,
    }

    // Build the update from only the fields that were sent
    const data: Prisma.TagCategoryUpdateInput = {};
    if (body.name !== undefined) {
      data.name = body.name.trim();
      if (!data.name) return reply.status(400).send({ error: 'Incorrect body', hint: 'Category name is empty' });
    }
    if (body.color !== undefined) data.color = body.color.toLowerCase();
    if (body.index !== undefined) data.index = body.index;
    if (body.isDefault) data.isDefault = true;

    try {
      const category = await prisma.$transaction(async (tx) => {
        if (body.isDefault) {
          await tx.tagCategory.updateMany({
            where: { isDefault: true, NOT: { id } },
            data: { isDefault: false }
          });
        }
        return tx.tagCategory.update({ where: { id }, data });
      });

      return reply.status(200).send(category);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') return reply.status(409).send({ error: 'A category with that name already exists' });
        if (e.code === 'P2025') return reply.status(404).send({ error: 'Category not found' });
      }
      logger.error('Failed to update category', e);
      return reply.status(500).send({ error: 'Something went wrong' });
    }
  })
}

export default tagCategories;