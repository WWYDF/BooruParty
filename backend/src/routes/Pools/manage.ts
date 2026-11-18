import { FastifyPluginAsync } from "fastify";
import { MAX_INT, MAX_POOL_DESCRIPTION_LENGTH, MAX_POOL_NAME_LENGTH } from "@/core/objects/limits";
import { poolSummarySelect } from "@/core/objects/selects/summaries";
import { prisma } from "@/core/plugins/prisma";
import { HttpError } from "@/core/utilities/errors";
import { requirePermission } from "@/core/utilities/permissionCache";

type PoolFields = {
  name?: string,
  description?: string | null,
  yearStart?: number,
  yearEnd?: number | null,
};

// Shared by create + edit so both enforce identical rules
const poolFieldSchemas = {
  name: { type: 'string', minLength: 1, maxLength: MAX_POOL_NAME_LENGTH },
  description: { type: ['string', 'null'], maxLength: MAX_POOL_DESCRIPTION_LENGTH },
  yearStart: { type: 'integer', minimum: 1000, maximum: 3000 },
  yearEnd: { type: ['integer', 'null'], minimum: 1000, maximum: 3000 },
};

// Trims text; a blank description becomes null (= cleared)
function cleanFields(body: PoolFields): PoolFields {
  const data: PoolFields = {};
  if (body.name !== undefined) {
    data.name = body.name.trim();
    if (!data.name) throw new HttpError(400, { error: 'Bad Request', hint: 'Name cannot be blank' });
  }
  if (body.description !== undefined) data.description = body.description?.trim() || null;
  if (body.yearStart !== undefined) data.yearStart = body.yearStart;
  if (body.yearEnd !== undefined) data.yearEnd = body.yearEnd;
  return data;
}

// yearEnd only makes sense as the end of a range
function checkYears(yearStart: number | null, yearEnd: number | null) {
  if (yearEnd !== null && yearStart === null) {
    throw new HttpError(400, { error: 'Bad Request', hint: 'yearEnd needs a yearStart' });
  }
  if (yearStart !== null && yearEnd !== null && yearEnd < yearStart) {
    throw new HttpError(400, { error: 'Bad Request', hint: 'yearEnd is before yearStart' });
  }
}


const managePools: FastifyPluginAsync = async (fastify) => {

  // Create an empty pool
  fastify.post('/', {
    onRequest: [fastify.authenticate, requirePermission('pool.create')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'yearStart'],
        additionalProperties: false,
        properties: poolFieldSchemas,
      },
    },
  }, async (req, reply) => {
    const data = cleanFields(req.body as PoolFields);
    checkYears(data.yearStart ?? null, data.yearEnd ?? null);

    const pool = await prisma.pool.create({
      data: { ...data, name: data.name!, yearStart: data.yearStart! }, // db requires name
      select: poolSummarySelect,
    });

    return reply.status(201).send(pool);
  });

  // Edit a pool's details (posts are handled separately)
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate, requirePermission('pool.manage')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: poolFieldSchemas,
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const data = cleanFields(req.body as PoolFields);

    await prisma.$transaction(async (tx) => {
      // Write first: locks the row (so concurrent edits queue up) and tells us if it exists
      const { count } = await tx.pool.updateMany({ where: { id }, data });
      if (count === 0) throw new HttpError(404, { error: 'Not found', hint: 'No pool with that id' });

      // Check the years as they are AFTER this edit; throwing rolls the update back
      const after = await tx.pool.findUniqueOrThrow({ where: { id }, select: { yearStart: true, yearEnd: true } });
      checkYears(after.yearStart, after.yearEnd);
    });

    return reply.status(204).send();
  });

  // Delete a pool (its posts are untouched; items + favorites cascade)
  fastify.delete('/:id', {
    onRequest: [fastify.authenticate, requirePermission('pool.delete')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1, maximum: MAX_INT } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };

    const { count } = await prisma.pool.deleteMany({ where: { id } });
    if (count === 0) throw new HttpError(404, { error: 'Not found', hint: 'No pool with that id' });

    return reply.status(204).send();
  });
};

export default managePools;
