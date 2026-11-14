import { appLogger } from "@/core/plugins/logger";
import { prisma } from "@/core/plugins/prisma";
import { requirePermission } from "@/core/utilities/permissionCache";
import { getImpliedTags, normalizeTagName } from "@/core/utilities/tags";
import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";
import { HttpError } from '@/core/utilities/errors';

const logger = appLogger('Tags');

// Loose limits here, normalizeTagName() enforces real values
const tagNameInputSchema = { type: 'string', minLength: 1, maxLength: 128 } as const;
const tagDescriptionSchema = { type: 'string', maxLength: 4096 } as const;

const relatedTagSelect = { id: true, name: true, categoryId: true } as const;

const tagDetailInclude = {
  category: true,
  names: { select: { name: true } },
  implications: { select: { implied: { select: relatedTagSelect } } },
  suggestions: { select: { suggested: { select: relatedTagSelect } } },
} satisfies Prisma.TagInclude;


type TagDetailRow = Prisma.TagGetPayload<{ include: typeof tagDetailInclude }>;

// Ensure tags return with the same details across endpoints
function shapeTagDetail({ implications, suggestions, names, ...tag }: TagDetailRow) {
  return {
    ...tag,
    aliases: names.map((n) => n.name).filter((n) => n !== tag.name),
    implications: implications.map((i) => i.implied),
    suggestions: suggestions.map((s) => s.suggested),
  };
}


const tags: FastifyPluginAsync = async (fastify) => {

  // Get a specific tag's info
  fastify.get('/:name', {
    schema: {
      params: {
        type: 'object',
        required: ['name'],
        properties: { name: tagNameInputSchema },
      },
    },
  }, async (req, reply) => {
    const { name: input } = req.params as { name: string };

    const normalized = normalizeTagName(input);
    if (!normalized.ok) return reply.status(404).send({ error: 'Tag not found' });

    const row = await prisma.tagName.findUnique({
      where: { name: normalized.name },
      select: { tag: { include: tagDetailInclude } },
    });
    if (!row) return reply.status(404).send({ error: 'Tag not found' });

    const { implications, suggestions, names, ...tag } = row.tag;

    return reply.status(200).send({
      ...shapeTagDetail(row.tag),
      allImplications: await getImpliedTags([tag.id]),
      matchedAlias: normalized.name !== tag.name ? normalized.name : null,
    });
  });

  // List / Search tags. Also serves auto-complete
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          search: { type: 'string', maxLength: 128 },
          match: { type: 'string', enum: ['contains', 'prefix'], default: 'contains' },
          categoryId: { type: 'integer', minimum: 1 },
          sort: { type: 'string', enum: ['popular', 'name', 'newest', 'oldest'], default: 'popular' },
        },
      },
    },
  }, async (req, reply) => {
    const { page, limit, search, match, categoryId, sort } = req.query as {
      page: number,
      limit: number,
      search?: string,
      match: 'contains' | 'prefix',
      categoryId?: number,
      sort: 'popular' | 'name' | 'newest' | 'oldest',
    };

    // Same cleanup as normalizeTagName(), but never rejects. Partial input like "blue " is fine here.
    const term = search?.normalize('NFC').trim().toLowerCase().replace(/\s+/g, '_') || undefined;
    const nameFilter: Prisma.StringFilter | undefined = term
      ? (match === 'prefix' ? { startsWith: term } : { contains: term })
      : undefined;

    const where: Prisma.TagWhereInput = {
      ...(categoryId !== undefined && { categoryId }),
      ...(nameFilter && { names: { some: { name: nameFilter } } })
    };

    const orderBy: Prisma.TagOrderByWithRelationInput[] =
      sort == 'name' ? [{ name: 'asc' }]
      : sort === 'newest' ? [{ createdAt: 'desc' }, { id: 'desc' }]
      : sort === 'oldest' ? [{ createdAt: 'asc' }, { id: 'asc' }]
      : [{ postCount: 'desc' }, { name: 'asc' }];
    
      const [tags, total] = await prisma.$transaction([
        prisma.tag.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            ...relatedTagSelect,
            postCount: true,
            category: true,
            // Only the names that matched, so the UI can show "pkmn -> pokemon"
            ...(nameFilter && { names: { where: { name: nameFilter }, select: { name: true } } }),
          },
        }),
        prisma.tag.count({ where }),
      ]);

      return reply.status(200).send({
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        tags,
      });
  });


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

  
  // Edit an existing tag. Array fields replace the whole list.
  fastify.patch('/:name', {
    onRequest: [fastify.authenticate, requirePermission('tags.edit')],
    schema: {
      params: {
        type: 'object',
        required: ['name'],
        properties: { name: tagNameInputSchema },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          name: tagNameInputSchema,
          categoryId: { type: 'integer', minimum: 1 },
          description: { type: ['string', 'null'], maxLength: 4096 },
          aliases: { type: 'array', maxItems: 50, items: tagNameInputSchema },
        },
      },
    },
  }, async (req, reply) => {
    const { name: input } = req.params as { name: string };
    const body = req.body as {
      name?: string,
      categoryId?: number,
      description?: string | null,
      aliases?: string[],
    };

    const current = normalizeTagName(input);
    if (!current.ok) return reply.status(404).send({ error: 'Tag not found' });

    // Validate every incoming name before touching the dtabase
    let newName: string | undefined;
    if (body.name !== undefined) {
      const n = normalizeTagName(body.name);
      if (!n.ok) return reply.status(400).send({ error: 'Invalid tag name', hint: n.reason });
      newName = n.name;
    }

    let aliases: string[] | undefined;
    if (body.aliases !== undefined) {
      const invalid: string[] = [];
      aliases = [];
      for (const a of body.aliases) {
        const n = normalizeTagName(a);
        if (n.ok) aliases.push(n.name);
        else invalid.push(`"${a}": ${n.reason}`);
      }
      if (invalid.length) return reply.status(400).send({ error: 'Invalid aliases', hint: invalid.join(" ") });
    }

    // Apply changes to database table
    try {
      const tagId = await prisma.$transaction(async (tx) => {
        const row = await tx.tagName.findUnique({
          where: { name: current.name },
          select: { tag: { select: { id: true, name: true, names: { select: { name: true } } } } },
        });
        if (!row) throw new HttpError(404, { error: 'Tag not found' });
        const tag = row.tag;

        // Names: sync TagName rows to exactly { primary, ...aliases }
        if (newName !== undefined || aliases !== undefined) {
          const primary = newName ?? tag.name;
          const existing = new Set(tag.names.map((n) => n.name));
          const keptAliases = aliases ?? [...existing].filter((n) => n !== tag.name);
          const desired = new Set([primary, ...keptAliases]);

          const toDelete = [...existing].filter((n) => !desired.has(n));
          const toCreate = [...desired].filter((n) => !existing.has(n));

          if (toCreate.length) {
            const taken = await tx.tagName.findMany({
              where: { name: { in: toCreate } },
              select: { name: true, tag: { select: { name: true } } },
            });
            if (taken.length) {
              throw new HttpError(409, {
                error: 'Name already in use',
                hint: taken.map((t) => `"${t.name}" belongs to "${t.tag.name}"`).join(', '),
              });
            }
          }

          await tx.tagName.deleteMany({ where: { tagId: tag.id, name: { in: toDelete } } });
          await tx.tagName.createMany({ data: toCreate.map((name) => ({ name, tagId: tag.id })) });
        }

        // Scalar fields
        const data: Prisma.TagUncheckedUpdateInput = {};
        if (newName !== undefined) data.name = newName;
        if (body.categoryId !== undefined) data.categoryId = body.categoryId;
        if (body.description !== undefined) data.description = body.description?.trim() || null;
        if (Object.keys(data).length) await tx.tag.update({ where: { id: tag.id }, data });

        return tag.id;
      });

      const updated = await prisma.tag.findUnique({ where: { id: tagId }, include: tagDetailInclude });
      return reply.status(200).send({
        ...shapeTagDetail(updated!),
        allImplications: await getImpliedTags([tagId]),
      });
    } catch (e) {
      if (e instanceof HttpError) return reply.status(e.status).send(e.body);
      if (e instanceof Prisma.PrismaClientKnownRequestError) {
        if (e.code === 'P2002') return reply.status(409).send({ error: 'Name already in use' });
        if (e.code === 'P2003') return reply.status(400).send({ error: 'Incorrect body', hint: 'Category does not exist' });
      }
      logger.error('Failed to update tag', e);
      return reply.status(500).send({ error: 'Something went wrong' });
    }
  });
}

export default tags;