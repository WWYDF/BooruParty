import { visibleConditions } from "@/components/posts/postQuery";
import { MAX_BULK_EDITS, MAX_INT, MAX_POST_TAGS, MAX_RELATED_POSTS } from "@/core/objects/limits";
import { Db, prisma } from "@/core/plugins/prisma";
import { getBrowsingViewer, getViewer, Viewer } from "@/core/utilities/viewer";
import { Prisma, Safety } from "../../../prisma/client";
import { FastifyPluginAsync } from "fastify";
import { requirePermission, rolePermissionCheck } from "@/core/utilities/permissionCache";
import { recountFavorites, recountScores, VoteValue } from "@/components/posts/interactions";
import { HttpError, isMissingRowError } from "@/core/utilities/errors";
import { cleanupDeletedPosts, deletePosts, postDeleteSelect } from "@/components/posts/delete";
import { resolveOrCreateTags, resolveTagNames } from "@/core/utilities/tags";
import { relationPair } from "@/components/posts/relations";

type BulkEditBody = {
  postIds: number[],
  addTags?: string[],
  removeTags?: string[],
  safety?: Safety,
  relateTo?: number,
  relateEachOther?: boolean,
};

const bulkTagsSchema = { type: 'array', minItems: 1, maxItems: MAX_POST_TAGS, items: { type: 'string' } } as const;


// Every bulk route takes the selected posts in the same shape
const postIdsSchema = {
  type: 'array', minItems: 1, maxItems: MAX_BULK_EDITS, uniqueItems: true,
  items: { type: 'integer', minimum: 1, maximum: MAX_INT },
} as const;

// Which of these ids the viewer can see. (All safeties, not their browsing preference)
// They selected these posts from a search, so a rating outside their default doesn't hide them from this
async function visibleIds(viewer: Viewer, postIds: number[]): Promise<number[]> {
  const rows = await prisma.post.findMany({
    where: { AND: [{ id: { in: postIds } }, ...visibleConditions(viewer, Object.values(Safety))] },
    select: { id: true },
  });
  return rows.map((p) => p.id);
}


// Adds/removes tags across many posts, keeping Tag.postCount and Post.tagCount in sync
// The caller must already hold the post locks
async function applyTagDiff(tx: Db, postIds: number[], addIds: number[], removeIds: number[]) {
  const delta = new Map<number, number>(); // tagId -> change in postCount

  if (removeIds.length) {
    // RETURNING gives back only the pairs that actually existed, so each tag drops by exactly that many
    const removed = await tx.$queryRaw<{ tagId: number }[]>`
      DELETE FROM "PostTag" WHERE "postId" = ANY(${postIds}) AND "tagId" = ANY(${removeIds})
      RETURNING "tagId"`;
    for (const r of removed) delta.set(r.tagId, (delta.get(r.tagId) ?? 0) - 1);
  }

  if (addIds.length) {
    // Every post x every tag. skipDupes + AndReturn = only the pairs that are new
    const added = await tx.postTag.createManyAndReturn({
      data: postIds.flatMap((postId) => addIds.map((tagId) => ({ postId, tagId }))),
      skipDuplicates: true,
      select: { tagId: true },
    });
    for (const r of added) delta.set(r.tagId, (delta.get(r.tagId) ?? 0) + 1);
  }

  if (delta.size) {
    // One statement, a different change per tag: unnest pairs the two arrays up row by row
    const tagIds = [...delta.keys()];
    const changes = [...delta.values()];
    await tx.$executeRaw`
      UPDATE "Tag" t SET "postCount" = t."postCount" + d.change
      FROM unnest(${tagIds}::int[], ${changes}::int[]) AS d(id, change)
      WHERE t.id = d.id`;
  }

  // Recount tagCount per post, and catch any posts this pushed over the tag cap
  const counts = await tx.$queryRaw<{ id: number, tagCount: number }[]>`
    UPDATE "Post" p SET "tagCount" = (SELECT COUNT(*) FROM "PostTag" pt WHERE pt."postId" = p.id)
    WHERE p.id = ANY(${postIds})
    RETURNING p.id, p."tagCount"`;
  const over = counts.filter((c) => c.tagCount > MAX_POST_TAGS).map((c) => c.id);
  if (over.length) {
    throw new HttpError(400, { error: 'Too many tags', hint: `Posts would exceed ${MAX_POST_TAGS} tags: ${over.join(', ')}` });
  }
}


const bulkPosts: FastifyPluginAsync = async (fastify) => {

  // Same as PUT /posts/:id/vote, for many posts at once
  fastify.put('/vote', {
    onRequest: [fastify.authenticate, requirePermission('posts.vote')],
    schema: {
      body: {
        type: 'object',
        required: ['postIds', 'value'],
        additionalProperties: false,
        properties: {
          postIds: postIdsSchema,
          value: { type: 'integer', enum: [-1, 0, 1] },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { postIds, value } = req.body as { postIds: number[], value: VoteValue };
    const userId = req.user.sub;

    const viewer = await getBrowsingViewer(req);
    const ids = await visibleIds(viewer, postIds);
    const skipped = postIds.filter((id) => !ids.includes(id)); // hidden or missing, same as 404

    if (ids.length) {
      try {
        await prisma.$transaction(async (tx) => {
          if (value === 0) {
            await tx.postVote.deleteMany({ where: { userId, postId: { in: ids } } });
          } else {
            await tx.postVote.updateMany({ where: { userId, postId: { in: ids }, value: { not: value } }, data: { value } });
            await tx.postVote.createMany({ data: ids.map((postId) => ({ postId, userId, value })), skipDuplicates: true });
          }
          await recountScores(tx, ids);
        });
      } catch (e) {
        // A post was deleted between the visibility check and the insert
        if (isMissingRowError(e)) return reply.status(409).send({ error: 'Conflict', hint: 'Some posts were deleted mid-request. Please retry.' });
        throw e;
      }
    }

    return reply.status(200).send({ updated: ids, skipped });
  });

  // Same as PUT /posts/:id/favorite, for many posts at once. New favorites also like the post.
  fastify.put('/favorite', {
    onRequest: [fastify.authenticate, requirePermission('posts.favorite')],
    schema: {
      body: {
        type: 'object',
        required: ['postIds', 'favorited'],
        additionalProperties: false,
        properties: {
          postIds: postIdsSchema,
          favorited: { type: 'boolean' },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { postIds, favorited } = req.body as { postIds: number[], favorited: boolean };
    const userId = req.user.sub;

    const viewer = await getBrowsingViewer(req);
    const ids = await visibleIds(viewer, postIds);
    const skipped = postIds.filter((id) => !ids.includes(id));

    const autoLike = rolePermissionCheck(req.user.roleId, 'posts.vote');

    if (ids.length) {
      try {
        await prisma.$transaction(async (tx) => {
          if (favorited) {
            // Only posts that weren't already favorited get the auto-like (same as the single route)
            const existing = await tx.postFavorite.findMany({
              where: { userId, postId: { in: ids } },
              select: { postId: true },
            });
            const had = new Set(existing.map((f) => f.postId));
            const newIds = ids.filter((id) => !had.has(id));

            if (newIds.length) {
              await tx.postFavorite.createMany({ data: newIds.map((postId) => ({ postId, userId })), skipDuplicates: true });

              if (autoLike) {
                await tx.postVote.updateMany({ where: { userId, postId: { in: newIds }, value: { not: 1 } }, data: { value: 1 } });
                await tx.postVote.createMany({ data: newIds.map((postId) => ({ postId, userId, value: 1 })), skipDuplicates: true });
                await recountScores(tx, newIds);
              }
            }
          } else {
            // Unfavoriting leaves votes alone
            await tx.postFavorite.deleteMany({ where: { userId, postId: { in: ids } } });
          }

          await recountFavorites(tx, ids);
        });
      } catch (e) {
        if (isMissingRowError(e)) return reply.status(409).send({ error: 'Conflict', hint: 'Some posts were deleted mid-request. Please retry.' });
        throw e;
      }
    }

    return reply.status(200).send({ updated: ids, skipped });
  });

  // Same as DELETE /posts/:id, for many posts at once.
  // Posts you can't delete (not yours without delete.others, or missing) are skipped, not a 403
  fastify.delete('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['postIds'],
        additionalProperties: false,
        properties: { postIds: postIdsSchema },
      },
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const { postIds } = req.body as { postIds: number[] };
    const userId = req.user.sub;

    const canOthers = rolePermissionCheck(req.user.roleId, 'posts.delete.others');
    const canOwn = rolePermissionCheck(req.user.roleId, 'posts.delete.own');

    // No delete perms at all: nothing in the batch could succeed, so say so instead of "skipped all"
    if (!canOthers && !canOwn) {
      return reply.status(403).send({ error: 'Forbidden', hint: 'Missing permission: posts.delete.own' });
    }

    // Same rule as the single route, per post: delete.others covers your own posts too
    const posts = await prisma.post.findMany({ where: { id: { in: postIds } }, select: postDeleteSelect });
    const allowed = posts.filter((p) => canOthers || p.uploaderId === userId);

    let deleted: number[] = [];
    if (allowed.length) {
      deleted = await prisma.$transaction((tx) => deletePosts(tx, allowed.map((p) => p.id)));
      await cleanupDeletedPosts(allowed.filter((p) => deleted.includes(p.id)));
    }

    const skipped = postIds.filter((id) => !deleted.includes(id));
    return reply.status(200).send({ updated: deleted, skipped });
  });

    // Bulk version of PATCH /posts/:id. Tags are a diff (add/remove), not a full list.
  // Posts you can't edit are skipped, same as bulk delete
  fastify.patch('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['postIds'],
        additionalProperties: false,
        minProperties: 2, // postIds + at least one change
        properties: {
          postIds: postIdsSchema,
          addTags: bulkTagsSchema,
          removeTags: bulkTagsSchema,
          safety: { type: 'string', enum: Object.values(Safety) },
          relateTo: { type: 'integer', minimum: 1, maximum: MAX_INT },
          relateEachOther: { type: 'boolean', const: true },
        },
      },
    },
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (req, reply) => {
    const body = req.body as BulkEditBody;
    const userId = req.user.sub;

    const canOthers = rolePermissionCheck(req.user.roleId, 'posts.edit.others');
    const canOwn = rolePermissionCheck(req.user.roleId, 'posts.edit.own');
    if (!canOthers && !canOwn) {
      return reply.status(403).send({ error: 'Forbidden', hint: 'Missing permission: posts.edit.own' });
    }

    if (body.relateTo !== undefined && body.relateEachOther) {
      return reply.status(400).send({ error: 'Invalid fields', hint: 'relateTo and relateToEachOther are mutually exclusive' });
    }

    const viewer = await getViewer(req); // related posts only link to posts the editor can see

    const posts = await prisma.post.findMany({ where: { id: { in: body.postIds } }, select: { id: true, uploaderId: true } });
    const allowedIds = posts.filter((p) => canOthers || p.uploaderId == userId).map((p) => p.id);

    let updated: number[] = [];
    if (allowedIds.length) {
      try {
        updated = await prisma.$transaction(async (tx) => {
          // Lock in id order so overlapping bulk edits/deletes queue instead of hiting brick in deadlock
          const locked = await tx.$queryRaw<{ id: number }[]>`
            SELECT id FROM "Post" WHERE id = ANY(${allowedIds}) ORDER BY id FOR UPDATE`;
          const ids = locked.map((r) => r.id);
          if (ids.length === 0) return ids;

          // updatedAt + Safety (if requested) for every post, even tag-only edits
          const data: Prisma.PostUpdateManyMutationInput = { updatedAt: new Date() };
          if (body.safety !== undefined) data.safety = body.safety;
          await tx.post.updateMany({ where: { id: { in: ids } }, data });

          // Tags
          if (body.addTags || body.removeTags) {
            const canCreate = rolePermissionCheck(req.user.roleId, 'tags.create');
            const add = body.addTags ? await resolveOrCreateTags(body.addTags, 'addTags', canCreate, tx) : []; // Unknown names are just skipped.
            const remove = body.removeTags ? (await resolveTagNames(body.removeTags, tx)).tags : [];

            // By id, so an alias in one list and its tag in the other still counts as a clash
            const removeIds = new Set(remove.map((t) => t.id));
            const clash = add.filter((t) => removeIds.has(t.id));
            if (clash.length) {
              throw new HttpError(400, { error: 'Invalid fields', hint: `In both addTags and removeTags: ${clash.map((t) => t.name)}` });
            }

            const addIds = [...new Set(add.map((t) => t.id))]; // an alias + its tag would otherwise be one pair twice
            await applyTagDiff(tx, ids, addIds, [...removeIds]);
          }

          // Related Posts
          if (body.relateTo !== undefined || body.relateEachOther) {
            const pairs: { fromId: number, toId: number }[] = [];
            let touched = ids; // every post that gains relations, for the cap check below

            if (body.relateTo !== undefined) {
              const target = body.relateTo;
              // Can't link what you can't see. Reported like a missing post, same as the single route
              const visible = await tx.post.count({
                where: { AND: [{ id: target }, ...visibleConditions(viewer, Object.values(Safety))] },
              });
              if (!visible) throw new HttpError(400, { error: 'Unknown posts', hint: `No post with id ${target}`, missing: [target] });

              for (const id of ids) if (id !== target) pairs.push(relationPair(id, target));
              touched = [...ids, target];
            } else {
              // Each post would gain ids.length - 1 relations. Refuse up front instead of writing thousands of rows to roll back
              if (ids.length - 1 > MAX_RELATED_POSTS) {
                throw new HttpError(400, { error: 'Too many related posts', hint: `Relating to each other allows at most ${MAX_RELATED_POSTS + 1} posts` });
              }
              for (let i = 0; i < ids.length; i++) {
                for (let j = i + 1; j < ids.length; j++) pairs.push(relationPair(ids[i], ids[j]));
              }
            }

            if (pairs.length) {
              await tx.postRelation.createMany({ data: pairs, skipDuplicates: true });

              // Cap check after the write (like tags): a post over the cap couldn't be saved from its own editor anymore
              const over = await tx.$queryRaw<{ id: number }[]>`
                SELECT p.id FROM unnest(${touched}::int[]) AS p(id)
                WHERE (SELECT COUNT(*) FROM "PostRelation" r WHERE r."fromId" = p.id OR r."toId" = p.id) > ${MAX_RELATED_POSTS}`;
              if (over.length) {
                throw new HttpError(400, { error: 'Too many related posts', hint: `Posts would exceed ${MAX_RELATED_POSTS} related: ${over.map((r) => r.id).join(', ')}` });
              }
            }
          }

          return ids;
        }, { timeout: 15_000 });
      } catch (e) {
        if (e instanceof HttpError) return reply.status(e.status).send(e.body);
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return reply.status(409).send({ error: 'Conflict', hint: 'A tag was created by someone else at the same moment. Please retry.' });
        if (isMissingRowError(e)) return reply.status(409).send({ error: 'Conflict', hint: 'A post was deleted mid-request. Please retry.' });
        throw e;
      }
    }

    const skipped = body.postIds.filter((id) => !updated.includes(id));
    return reply.status(200).send({ updated, skipped });
  });
}

export default bulkPosts;