import { appLogger } from "@/core/plugins/logger";
import { prisma } from "@/core/plugins/prisma";
import { requirePermission } from "@/core/utilities/permissionCache";
import { Db, getImpliedTags, normalizeTagName, resolveTagNames, wouldCreateCycle } from "@/core/utilities/tags";
import { FastifyPluginAsync } from "fastify";
import { Prisma, TagFlag } from "../../../prisma/client";
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

// Resolve names to existing tags, or throw a 400 listing what's wrong
async function resolveExistingTags(names: string[], field: string, db: Db) {
  const { tags, missing, invalid } = await resolveTagNames(names, db);

  if (invalid.length) {
    throw new HttpError(400, {
      error: `Invalid ${field}`,
      hint: invalid.map((i) => `"${i.input}": ${i.reason}`).join(' '),
    });
  }
  if (missing.length) {
    throw new HttpError(400, { error: `Unknown tags in ${field}`, hint: missing.join(', '), missing });
  }

  return tags;
}



const tags: FastifyPluginAsync = async (fastify) => {

  //  _______  _______ _________    _________ _______  _______ 
  // (  ____ \(  ____ \\__   __/    \__   __/(  ___  )(  ____ \
  // | (    \/| (    \/   ) (          ) (   | (   ) || (    \/
  // | |      | (__       | |          | |   | (___) || |      
  // | | ____ |  __)      | |          | |   |  ___  || | ____ 
  // | | \_  )| (         | |          | |   | (   ) || | \_  )
  // | (___) || (____/\   | |          | |   | )   ( || (___) |
  // (_______)(_______/   )_(          )_(   |/     \|(_______)
  // 

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

  //  _______  _______  _______  _______  _______              _________ _______  _______  _______ 
  // (  ____ \(  ____ \(  ___  )(  ____ )(  ____ \|\     /|    \__   __/(  ___  )(  ____ \(  ____ \
  // | (    \/| (    \/| (   ) || (    )|| (    \/| )   ( |       ) (   | (   ) || (    \/| (    \/
  // | (_____ | (__    | (___) || (____)|| |      | (___) |       | |   | (___) || |      | (_____ 
  // (_____  )|  __)   |  ___  ||     __)| |      |  ___  |       | |   |  ___  || | ____ (_____  )
  //       ) || (      | (   ) || (\ (   | |      | (   ) |       | |   | (   ) || | \_  )      ) |
  // /\____) || (____/\| )   ( || ) \ \__| (____/\| )   ( |       | |   | )   ( || (___) |/\____) |
  // \_______)(_______/|/     \||/   \__/(_______/|/     \|       )_(   |/     \|(_______)\_______)
  //

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


  //  _______  _______  _______  _______ _________ _______   _________ _______  _______ 
  // (  ____ \(  ____ )(  ____ \(  ___  )\__   __/(  ____ \  \__   __/(  ___  )(  ____ \
  // | (    \/| (    )|| (    \/| (   ) |   ) (   | (    \/     ) (   | (   ) || (    \/
  // | |      | (____)|| (__    | (___) |   | |   | (__         | |   | (___) || |      
  // | |      |     __)|  __)   |  ___  |   | |   |  __)        | |   |  ___  || | ____ 
  // | |      | (\ (   | (      | (   ) |   | |   | (           | |   | (   ) || | \_  )
  // | (____/\| ) \ \__| (____/\| )   ( |   | |   | (____/\     | |   | )   ( || (___) |
  // (_______/|/   \__/(_______/|/     \|   )_(   (_______/     )_(   |/     \|(_______)
  //


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


  //  _______  ______  __________________    _________ _______  _______ 
  // (  ____ \(  __  \ \__   __/\__   __/    \__   __/(  ___  )(  ____ \
  // | (    \/| (  \  )   ) (      ) (          ) (   | (   ) || (    \/
  // | (__    | |   ) |   | |      | |          | |   | (___) || |      
  // |  __)   | |   | |   | |      | |          | |   |  ___  || | ____ 
  // | (      | |   ) |   | |      | |          | |   | (   ) || | \_  )
  // | (____/\| (__/  )___) (___   | |          | |   | )   ( || (___) |
  // (_______/(______/ \_______/   )_(          )_(   |/     \|(_______)
  //
  
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
          implications: { type: 'array', maxItems: 50, items: tagNameInputSchema },
          suggestions: { type: 'array', maxItems: 50, items: tagNameInputSchema },
          flags: { type: 'array', uniqueItems: true, items: { type: 'string', enum: Object.values(TagFlag) } },
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
      implications?: string[],
      suggestions?: string[],
      flags?: TagFlag[],
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
        if (body.flags !== undefined) data.flags = body.flags; // full replacement, like aliases
        if (Object.keys(data).length) await tx.tag.update({ where: { id: tag.id }, data });

        
        // Implications: diff against current, remove first, cycle-check additions
        if (body.implications !== undefined) {
          const targets = await resolveExistingTags(body.implications, 'implications', tx);
          const nameById = new Map(targets.map((t) => [t.id, t.name]));

          const current = await tx.tagImplication.findMany({ where: { tagId: tag.id }, select: { impliedId: true } });
          const currentIds = new Set(current.map((c) => c.impliedId));
          const desiredIds = new Set(targets.map((t) => t.id));

          const toRemove = [...currentIds].filter((id) => !desiredIds.has(id));
          const toAdd = [...desiredIds].filter((id) => !currentIds.has(id));

          await tx.tagImplication.deleteMany({ where: { tagId: tag.id, impliedId: { in: toRemove } } });

          for (const impliedId of toAdd) {
            if (await wouldCreateCycle(tag.id, impliedId, tx)) {
              throw new HttpError(400, {
                error: 'Implication loop',
                hint: impliedId === tag.id
                  ? 'A tag cannot imply itself'
                  : `"${nameById.get(impliedId)}" already implies this tag (directly or through a chain)`,
              });
            }
          }

          await tx.tagImplication.createMany({ data: toAdd.map((impliedId) => ({ tagId: tag.id, impliedId })) });
        }

        // Suggestions: same diff, no chains, so no cycle check needed
        if (body.suggestions !== undefined) {
          const targets = await resolveExistingTags(body.suggestions, 'suggestions', tx);
          if (targets.some((t) => t.id === tag.id)) {
            throw new HttpError(400, { error: 'Invalid suggestions', hint: 'A tag cannot suggest itself' });
          }

          const current = await tx.tagSuggestion.findMany({ where: { tagId: tag.id }, select: { suggestedId: true } });
          const currentIds = new Set(current.map((c) => c.suggestedId));
          const desiredIds = new Set(targets.map((t) => t.id));

          await tx.tagSuggestion.deleteMany({
            where: { tagId: tag.id, suggestedId: { in: [...currentIds].filter((id) => !desiredIds.has(id)) } },
          });
          await tx.tagSuggestion.createMany({
            data: [...desiredIds].filter((id) => !currentIds.has(id)).map((suggestedId) => ({ tagId: tag.id, suggestedId })),
          });
        }


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


  //  ______   _______  _        _______ _________ _______     _________ _______  _______ 
  // (  __  \ (  ____ \( \      (  ____ \\__   __/(  ____ \    \__   __/(  ___  )(  ____ \
  // | (  \  )| (    \/| (      | (    \/   ) (   | (    \/       ) (   | (   ) || (    \/
  // | |   ) || (__    | |      | (__       | |   | (__           | |   | (___) || |      
  // | |   | ||  __)   | |      |  __)      | |   |  __)          | |   |  ___  || | ____ 
  // | |   ) || (      | |      | (         | |   | (             | |   | (   ) || | \_  )
  // | (__/  )| (____/\| (____/\| (____/\   | |   | (____/\       | |   | )   ( || (___) |
  // (______/ (_______/(_______/(_______/   )_(   (_______/       )_(   |/     \|(_______)
  //

  // Delete a tag. Must be addressed by its primary name, not an alias.
  fastify.delete('/:name', {
    onRequest: [fastify.authenticate, requirePermission('tags.delete')],
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
      select: { tag: { select: { id: true, name: true, _count: { select: { posts: true } } } } },
    });
    if (!row) return reply.status(404).send({ error: 'Tag not found' });

    // DELETE /tags/pkmn must not silently delete "pokemon"
    if (row.tag.name !== normalized.name) {
      return reply.status(400).send({
        error: 'Cannot delete an alias',
        hint: `"${normalized.name}" is an alias of "${row.tag.name}". Edit "${row.tag.name}" to remove the alias.`,
      });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Every post carrying this tag loses one tag. Before the delete: the cascade removes the PostTag rows we match on.
        await tx.post.updateMany({
          where: { tags: { some: { tagId: row.tag.id } } },
          data: { tagCount: { decrement: 1 } },
        });
        await tx.tag.delete({ where: { id: row.tag.id } });
      });
    } catch (e) {
      // Someone else deleted (or merged) it between our lookup and now
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        return reply.status(404).send({ error: 'Tag not found' });
      }
      logger.error('Failed to delete tag', e);
      return reply.status(500).send({ error: 'Something went wrong' });
    }

    return reply.status(200).send({ deleted: row.tag.name, removedFromPosts: row.tag._count.posts });
  });


  //  _______  _______  _______  _______  _______     _________ _______  _______  _______ 
  // (       )(  ____ \(  ____ )(  ____ \(  ____ \    \__   __/(  ___  )(  ____ \(  ____ \
  // | () () || (    \/| (    )|| (    \/| (    \/       ) (   | (   ) || (    \/| (    \/
  // | || || || (__    | (____)|| |      | (__           | |   | (___) || |      | (_____ 
  // | |(_)| ||  __)   |     __)| | ____ |  __)          | |   |  ___  || | ____ (_____  )
  // | |   | || (      | (\ (   | | \_  )| (             | |   | (   ) || | \_  )      ) |
  // | )   ( || (____/\| ) \ \__| (___) || (____/\       | |   | )   ( || (___) |/\____) |
  // |/     \|(_______/|/   \__/(_______)(_______/       )_(   |/     \|(_______)\_______)
  //

  // Merge one tag into another. Source is deleted; its posts, links and (optionally) names move to the target.
  fastify.post('/:name/merge', {
    onRequest: [fastify.authenticate, requirePermission('tags.delete')],
    schema: {
      params: {
        type: 'object',
        required: ['name'],
        properties: { name: tagNameInputSchema },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['into'],
        properties: {
          into: tagNameInputSchema,
          keepNames: { type: 'boolean', default: true }, // source's name + aliases become aliases of target
        },
      },
    },
  }, async (req, reply) => {
    const { name: input } = req.params as { name: string };
    const body = req.body as { into: string, keepNames: boolean };

    const sourceName = normalizeTagName(input);
    const targetName = normalizeTagName(body.into);
    if (!sourceName.ok) return reply.status(404).send({ error: 'Tag not found' });
    if (!targetName.ok) return reply.status(400).send({ error: 'Invalid target', hint: targetName.reason });

    try {
      const result = await prisma.$transaction(async (tx) => {
        const [sourceRow, targetRow] = await Promise.all([
          tx.tagName.findUnique({ where: { name: sourceName.name }, select: { tag: { select: { id: true, name: true } } } }),
          tx.tagName.findUnique({ where: { name: targetName.name }, select: { tag: { select: { id: true, name: true } } } }),
        ]);
        if (!sourceRow) throw new HttpError(404, { error: 'Tag not found' });
        if (!targetRow) throw new HttpError(404, { error: 'Target tag not found' });

        const source = sourceRow.tag;
        const target = targetRow.tag;

        if (source.name !== sourceName.name) {
          throw new HttpError(400, { error: 'Cannot merge an alias', hint: `"${sourceName.name}" is an alias of "${source.name}"` });
        }
        if (source.id === target.id) {
          throw new HttpError(400, { error: 'Cannot merge a tag into itself' });
        }

        // 0. Posts that have BOTH tags end up with one fewer tag (the cascade drops their source row and step 1 adds nothing)
        // Must run before step 1, while "has target" still means "had it already".
        await tx.$executeRaw`
          UPDATE "Post" SET "tagCount" = "tagCount" - 1
          WHERE "id" IN (SELECT "postId" FROM "PostTag" WHERE "tagId" = ${source.id})
            AND "id" IN (SELECT "postId" FROM "PostTag" WHERE "tagId" = ${target.id})
        `;

        // 1. Posts: give every source post the target tag (skip posts that already have it)
        const movedPosts = await tx.$executeRaw`
          INSERT INTO "PostTag" ("postId", "tagId")
          SELECT "postId", ${target.id} FROM "PostTag" WHERE "tagId" = ${source.id}
          ON CONFLICT DO NOTHING
        `;

        // 2. Implications, both directions (never target -> target)
        await tx.$executeRaw`
          INSERT INTO "TagImplication" ("tagId", "impliedId")
          SELECT ${target.id}, "impliedId" FROM "TagImplication"
          WHERE "tagId" = ${source.id} AND "impliedId" <> ${target.id}
          ON CONFLICT DO NOTHING
        `;
        await tx.$executeRaw`
          INSERT INTO "TagImplication" ("tagId", "impliedId")
          SELECT "tagId", ${target.id} FROM "TagImplication"
          WHERE "impliedId" = ${source.id} AND "tagId" <> ${target.id}
          ON CONFLICT DO NOTHING
        `;

        // 3. Suggestions, both directions
        await tx.$executeRaw`
          INSERT INTO "TagSuggestion" ("tagId", "suggestedId")
          SELECT ${target.id}, "suggestedId" FROM "TagSuggestion"
          WHERE "tagId" = ${source.id} AND "suggestedId" <> ${target.id}
          ON CONFLICT DO NOTHING
        `;
        await tx.$executeRaw`
          INSERT INTO "TagSuggestion" ("tagId", "suggestedId")
          SELECT "tagId", ${target.id} FROM "TagSuggestion"
          WHERE "suggestedId" = ${source.id} AND "tagId" <> ${target.id}
          ON CONFLICT DO NOTHING
        `;

        // 4. Names: hand them to the target before the cascade would delete them
        if (body.keepNames) {
          await tx.tagName.updateMany({ where: { tagId: source.id }, data: { tagId: target.id } });
        }

        // 5. Delete source. Cascades clean up its remaining PostTag / link / name rows.
        await tx.tag.delete({ where: { id: source.id } });

        // 6. Merging can close a loop (e.g. source -> X and X -> target). Any new loop must pass through target.
        const direct = await tx.tagImplication.findMany({ where: { tagId: target.id }, select: { impliedId: true } });
        const reachable = await getImpliedTags(direct.map((d) => d.impliedId), tx);
        if (reachable.some((t) => t.id === target.id)) {
          throw new HttpError(409, { error: 'Implication loop', hint: `Merging would make "${target.name}" imply itself. Fix the implications first.` });
        }

        // 7. Recount target
        await tx.$executeRaw`
          UPDATE "Tag" SET "postCount" = (SELECT COUNT(*) FROM "PostTag" WHERE "tagId" = ${target.id})
          WHERE "id" = ${target.id}
        `;

        return { targetId: target.id, merged: source.name, movedPosts };
      });

      const updated = await prisma.tag.findUnique({ where: { id: result.targetId }, include: tagDetailInclude });
      return reply.status(200).send({
        merged: result.merged,
        movedPosts: result.movedPosts,
        tag: { ...shapeTagDetail(updated!), allImplications: await getImpliedTags([result.targetId]) },
      });
    } catch (e) {
      if (e instanceof HttpError) return reply.status(e.status).send(e.body);
      logger.error('Failed to merge tags', e);
      return reply.status(500).send({ error: 'Something went wrong' });
    }
  });
}

export default tags;