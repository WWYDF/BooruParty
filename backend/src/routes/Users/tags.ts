import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";
import { tagChipSelect } from "@/core/objects/selects/summaries";
import { prisma } from "@/core/plugins/prisma";
import { HttpError } from "@/core/utilities/errors";
import { getServerSettings } from "@/core/utilities/settingsCache";
import { resolveTagNames } from "@/core/utilities/tags";

type ListKind = 'favorites' | 'blacklist';

// Both lists, oldest first (favorites show on the profile in the order they were added)
async function readLists(userId: string, db: Prisma.TransactionClient = prisma) {
  const orderBy = [
    { tag: { category: { index: 'asc' as const } } },
    { tag: { name: 'asc' as const } },
  ];
  const [favorites, blacklist] = await Promise.all([
    db.userFavoriteTag.findMany({ where: { userId }, orderBy, select: { tag: { select: tagChipSelect } } }),
    db.userBlacklistedTag.findMany({ where: { userId }, orderBy, select: { tag: { select: tagChipSelect } } }),
  ]);
  const settings = getServerSettings();
  return {
    favorites: favorites.map((f) => f.tag),
    blacklist: blacklist.map((b) => b.tag),
    limits: { favorites: settings.maxFavoriteTags, blacklist: settings.maxBlacklistTags },
  };
}

const namesBody = {
  type: 'object',
  required: ['names'],
  additionalProperties: false,
  properties: {
    names: { type: 'array', maxItems: 500, items: { type: 'string', minLength: 1, maxLength: 128 } },
  },
} as const;


const tagLists: FastifyPluginAsync = async (fastify) => {

  fastify.addHook('onRequest', fastify.authenticate);

  fastify.get('/', async (req, reply) => {
    return reply.send(await readLists(req.user.sub));
  });

  // PUT /favorites and PUT /blacklist: names = the whole new list ([] clears it)
  for (const kind of ['favorites', 'blacklist'] as const satisfies readonly ListKind[]) {
    fastify.put(`/${kind}`, { schema: { body: namesBody } }, async (req, reply) => {
      const userId = req.user.sub;
      const { names } = req.body as { names: string[] };

      // Aliases resolve to their real tag; unknown or invalid names are an error (lists only hold real tags)
      const { tags, missing, invalid } = await resolveTagNames(names);
      if (missing.length || invalid.length) {
        throw new HttpError(400, { error: 'Bad Request', hint: 'Unknown tags', missing, invalid });
      }

      const settings = getServerSettings();
      const max = kind === 'favorites' ? settings.maxFavoriteTags : settings.maxBlacklistTags;
      if (tags.length > max) {
        throw new HttpError(400, { error: 'Bad Request', hint: `You can have up to ${max} ${kind === 'favorites' ? 'favorite' : 'blacklisted'} tags` });
      }

      const tagIds = tags.map((t) => t.id);

      const lists = await prisma.$transaction(async (tx) => {
        // Lock this user's row: two saves at once queue up instead of mixing their lists
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

        // Diff, not wipe + rewrite: tags you kept keep their createdAt (= their spot on your profile)
        if (kind === 'favorites') {
          await tx.userFavoriteTag.deleteMany({ where: { userId, tagId: { notIn: tagIds } } });
          await tx.userFavoriteTag.createMany({ data: tagIds.map((tagId) => ({ userId, tagId })), skipDuplicates: true });
        } else {
          await tx.userBlacklistedTag.deleteMany({ where: { userId, tagId: { notIn: tagIds } } });
          await tx.userBlacklistedTag.createMany({ data: tagIds.map((tagId) => ({ userId, tagId })), skipDuplicates: true });
        }

        return readLists(userId, tx);
      });

      return reply.send(lists);
    });
  }
};

export default tagLists;
