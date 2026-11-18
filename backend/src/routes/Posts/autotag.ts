// This is an optional addon, so if the autoTagger addon is disabled, these will return nothing.

import { matchPredictions, predictTags } from "@/components/addons/autotagger";
import { thumbnailFilePaths } from "@/components/uploads/finalize";
import { appLogger } from "@/core/plugins/logger";
import { prisma } from "@/core/plugins/prisma";
import { getServerAddons } from "@/core/utilities/addonsCache";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";
import { FastifyPluginAsync } from "fastify";
import fs from "fs";

const logger = appLogger('AutoTagger');

const autoTagPosts: FastifyPluginAsync = async (fastify) => {
  // PASSIVE MODE: Suggestions for the post editor. Nothing is saved here.
  fastify.get('/:id/autotag', {
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

    const { enableAutoTagger, autoTaggerUrl, autoTaggerMode } = getServerAddons();
    if (!enableAutoTagger || !autoTaggerUrl || !autoTaggerMode.includes('PASSIVE')) {
      return reply.status(404).send({ error: 'Not found', hint: 'The AutoTagger is not enabled' })
    }

    const post = await prisma.post.findUnique({ where: { id }, select: { uploaderId: true, fileKey: true } });
    if (!post) return reply.status(404).send({ error: 'Not found', hint: `No post with that id` });

    const isOwner = post.uploaderId === req.user.sub;
    const allowed = rolePermissionCheck(req.user.roleId, 'posts.edit.others')
      || (isOwner && rolePermissionCheck(req.user.roleId, 'posts.edit.own'));

    if (!allowed) {
      return reply.status(403).send({ error: 'Forbidden', hint: `Missing permission ${isOwner ? 'posts.edit.own' : 'posts.edit.others'}` });
    }

    // The auto-generated "large" thumbnail (last in THUMBNAIL_SIZES order)
    const largeThumb = thumbnailFilePaths(post.fileKey).at(-1)!;

    let image: Blob;
    try {
      image = new Blob([await fs.promises.readFile(largeThumb)], { type: 'image/webp' });
    } catch (e) {
      logger.error(`Upstream request failed for post ${id}`, e);
      return reply.status(502).send({ error: 'AutoTagger Unavailable', hint: 'The tagging service did not respond' });
    }

    try {
      return await matchPredictions(await predictTags(image));
    } catch (e) {
      logger.error(`Upstream request failed for post ${id}`, e);
      return reply.status(502).send({ error: 'AutoTagger Unavailable', hint: 'The tagging service did not respond' });
    }
  });
}

export default autoTagPosts;