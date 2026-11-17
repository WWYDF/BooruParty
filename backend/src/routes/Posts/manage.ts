import { FastifyPluginAsync } from "fastify"
import { Prisma, Safety } from "../../../prisma/client"
import { isHttpUrl } from "@/components/uploads/fields";
import { prisma } from "@/core/plugins/prisma";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";
import { HttpError } from "@/core/utilities/errors";
import { ResolvedTag, resolveTagNames } from "@/core/utilities/tags";
import { discardFiles, postFilePaths } from "@/components/uploads/finalize";
import { appLogger } from "@/core/plugins/logger";
import { MAX_POST_NOTES_LENGTH, MAX_POST_SOURCE_LENGTH, MAX_POST_SOURCES, MAX_POST_TAGS, MAX_RELATED_POSTS } from "@/core/objects/limits";
import { getViewer } from "@/core/utilities/viewer";
import { visibleConditions } from "@/components/posts/postQuery";
import { getServerSettings, loadServerSettings } from "@/core/utilities/settingsCache";

const logger = appLogger('Posts/Manage');

type EditBody = {
  safety?: Safety,
  sources?: string[],
  notes?: string | null,
  tags?: string[],
  related?: number[],
}

// PostRelation stores each pair once, lower id first. Every read/write goes through this
function relationPair(a: number, b: number) {
  return a < b ? { fromId: a, toId: b } : { fromId: b, toId: a };
}

const managePosts: FastifyPluginAsync = async (fastify) => {
  fastify.patch('/:id', {
    onRequest: [fastify.authenticate],
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
          safety: { type: 'string', enum: Object.values(Safety) },
          sources: { type: 'array', maxItems: MAX_POST_SOURCES, items: { type: 'string', maxLength: MAX_POST_SOURCE_LENGTH } },
          notes: { type: ['string', 'null'], maxLength: MAX_POST_NOTES_LENGTH },
          tags: { type: 'array', maxItems: MAX_POST_TAGS, items: { type: 'string' } },
          related: { type: 'array', maxItems: MAX_RELATED_POSTS, items: { type: 'integer', minimum: 1 } },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };
    const body = req.body as EditBody;
    const viewer = await getViewer(req);

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, uploaderId: true }
    });
    if (!post) { return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' }); };

    // edit.others covers your own posts too, edit.own only covers yours
    const isOwner = post.uploaderId === req.user.sub;
    const allowed = rolePermissionCheck(req.user.roleId, 'posts.edit.others')
      || (isOwner && rolePermissionCheck(req.user.roleId, 'posts.edit.own'));

    if (!allowed) {
      return reply.status(403).send({
        error: 'Forbidden',
        hint: `Missing permission ${isOwner ? 'posts.edit.own' : 'posts.edit.others'}`
      });
    }

    // Continue with edits now that perms have cleared

    // Only copy fields that were sent (undefined = leave untouched)
    const data: Prisma.PostUpdateManyMutationInput = { updatedAt: new Date() };

    if (body.safety !== undefined) data.safety = body.safety;
    if (body.notes !== undefined) data.notes = body.notes?.trim() || null;

    if (body.sources !== undefined) {
      // trum, drop blank rows from the editor, de-dupe
      const sources = [...new Set(body.sources.map((s) => s.trim()).filter(Boolean))];
      const bad = sources.find((s) => !isHttpUrl(s));
      if (bad !== undefined) { return reply.status(400).send({ error: 'Invalid fields', hint: `Invalid source URL: ${bad.slice(0, 100)}` }) };
      data.sources = sources;
    }

    try {
      await prisma.$transaction(async (tx) => {
        // updateMany instead of update (returns a count rather than throwing if post vanished)
        const { count } = await tx.post.updateMany({ where: { id }, data });
        if (count === 0) throw new HttpError(404, { error: 'Not found', hint: 'No post with that id' });

        // Tags
        if (body.tags !== undefined) {
          const { tags: found, missing, invalid } = await resolveTagNames(body.tags, tx);

          if (invalid.length) {
            throw new HttpError(400, { error: 'Invalid tags', hint: invalid.map((i) => `"${i.input}": ${i.reason}`).join(' ') });
          }

          // Unknown tags get created in default category if allowed by user's permissions
          let created: ResolvedTag[] = []
          if (missing.length) {
            if (!rolePermissionCheck(req.user.roleId, 'tags.create')) {
              throw new HttpError(403, { error: 'Forbidden', hint: `Missing permission: tags.create (unknown tags: ${missing.join(', ')})`, missing });
            }

            const category = await tx.tagCategory.findFirst({ where: { isDefault: true }, select: { id: true } });
            if (!category) throw new Error('No default tag category exists');

            created = await tx.tag.createManyAndReturn({
              data: missing.map((name) => ({ name, categoryId: category.id })),
              select: { id: true, name: true },
            });
            await tx.tagName.createMany({ data: created.map((t) => ({ name: t.name, tagId: t.id })) });
          }
          
          // Diff: what the post should have vs what is has now
          const wanted = new Set([...found, ...created].map((t) => t.id));
          const current = await tx.postTag.findMany({ where: { postId: id }, select: { tagId: true } });
          const have = new Set(current.map((r) => r.tagId));

          const toAdd = [...wanted].filter((tagId) => !have.has(tagId));
          const toRemove = [...have].filter((tagId) => !wanted.has(tagId));

          if (toRemove.length) {
            await tx.postTag.deleteMany({ where: { postId: id, tagId: { in: toRemove } } });
            await tx.tag.updateMany({ where: { id: { in: toRemove } }, data: { postCount: { decrement: 1 } } });
          }

          if (toAdd.length) {
            await tx.postTag.createMany({ data: toAdd.map((tagId) => ({ postId: id, tagId })) });
            await tx.tag.updateMany({ where: { id: { in: toAdd } }, data: { postCount: { increment: 1 } } });
          }

          await tx.post.update({ where: { id }, data: { tagCount: wanted.size }});
        }

        // Related posts (full replacement list, but only for posts this editor can see)
        if (body.related !== undefined) {
          const wanted = new Set(body.related.filter((rid) => rid !== id)); // can't relate a post to itself

          // This post can be on either side of a stored pair
          const current = await tx.postRelation.findMany({
            where: { OR: [{ fromId: id }, { toId: id }] },
            select: { fromId: true, toId: true },
          });
          const have = new Set(current.map((r) => (r.fromId === id ? r.toId : r.fromId)));

          // Which of these posts the editor can actually see (the same rules GET /:id used to build their list)
          const candidates = [...new Set([...wanted, ...have])];
          const visible = new Set(
            candidates.length
              ? (await tx.post.findMany({
                  where: { AND: [{ id: { in: candidates } }, ...visibleConditions(viewer)] },
                  select: { id: true },
                })).map((p) => p.id)
              : [],
          );

          const toAdd = [...wanted].filter((rid) => !have.has(rid));
          // Relations to posts the editor can't see never reached their editor, so leaving them out isn't a removal
          const toRemove = [...have].filter((rid) => !wanted.has(rid) && visible.has(rid));

          // Can't link what you can't see. Reported like a missing post, so private ids can't be probed
          const unknown = toAdd.filter((rid) => !visible.has(rid));
          if (unknown.length) {
            throw new HttpError(400, { error: 'Unknown posts', hint: `No posts with ids: ${unknown.join(', ')}`, missing: unknown });
          }

          if (toRemove.length) {
            await tx.postRelation.deleteMany({ where: { OR: toRemove.map((rid) => relationPair(id, rid)) } });
          }

          if (toAdd.length) {
            await tx.postRelation.createMany({ data: toAdd.map((rid) => relationPair(id, rid)), skipDuplicates: true });
          }
        }
      })
    } catch (e) {
      if (e instanceof HttpError) return reply.status(e.status).send(e.body);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code == 'P2002') {
        return reply.status(409).send({ error: 'Conflict', hint: 'A tag was created by someone else at the same moment. Please retry.' })
      }
      throw e;
    }

    return reply.status(204).send();
  });

  fastify.delete('/:id', {
    onRequest: [fastify.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'integer', minimum: 1 } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: number };

    const post = await prisma.post.findUnique({
      where: { id },
      select: { id: true, uploaderId: true, fileKey: true, thumbKey: true, originalPath: true, previewPath: true }
    });
    if (!post) return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });

    // Same rule as editing, delete.others covers your own posts too
    const isOwner = post.uploaderId === req.user.sub;
    const allowed = rolePermissionCheck(req.user.roleId, 'posts.delete.others')
      || (isOwner && rolePermissionCheck(req.user.roleId, 'posts.delete.own'));

    if (!allowed) {
      return reply.status(403).send({ error: 'Forbidden', hint: `Missing permission: ${isOwner ? 'posts.delete.own' : 'posts.delete.others'}` });
    }

    try {
      await prisma.$transaction(async (tx) => {
        // Lock the post row. A concurrent edit or delete of this post waits until we're done.
        const locked = await tx.$queryRaw<{id: number }[]>`SELECT id FROM "Post" WHERE id = ${id} FOR UPDATE`;
        if (locked.length === 0) throw new HttpError(404, { error: 'Not found', hint: 'No post with that id' });

        // -1 on every tag this post has, in one query, BEFORE the cascade removes the PostTag rows
        await tx.tag.updateMany({
          where: { posts: { some: { postId: id } } },
          data: { postCount: { decrement: 1 } }
        });

        await tx.post.delete({ where: { id } }); // cascades PostTag rows
      });
    } catch (e) {
      if (e instanceof HttpError) return reply.status(e.status).send(e.body);
      throw e;
    };

    // Only after the commit: if the tx had failed, the post would still need its files
    try {
      await discardFiles(postFilePaths(post));

      // if this post was featured, refresh the serverSettings cache
      if (getServerSettings().featuredPostId === id) await loadServerSettings();
    } catch (e) {
      logger.error(`Post ${id} deleted, but some of its files could not be removed`, e);
    }

    return reply.status(204).send();
  });
};

export default managePosts;