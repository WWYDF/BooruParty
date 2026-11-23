import { FastifyPluginAsync } from "fastify";
import { appLogger } from "@/core/plugins/logger";
import { requirePermission, rolePermissionCheck } from "@/core/utilities/permissionCache";
import crypto from 'node:crypto';
import path from "node:path";
import fs from "fs";
import { cleanupTemp, tempDir } from "@/components/uploads/receive";
import { pipeline } from 'node:stream/promises';
import { getField, parseUploadFields } from "@/components/uploads/fields";
import { discardFiles } from "@/components/uploads/finalize";
import { prisma } from "@/core/plugins/prisma";
import { withAssetUrls } from "@/core/utilities/reformatters";
import { resolveTagNames } from "@/core/utilities/tags";
import { HttpError } from "@/core/utilities/errors";
import { Prisma } from "../../../prisma/client";
import { processUpload } from "@/components/uploads/process";
import { MAX_UPLOAD_BYTES } from "@/core/objects/limits";
import { getServerAddons } from "@/core/utilities/addonsCache";
import { autoTagFromThumbnail } from "@/components/addons/autotagger";

const logger = appLogger('Posts/Create');

const createPost: FastifyPluginAsync = async (fastify) => {
  fastify.post('/create', {
    onRequest: [fastify.authenticate, requirePermission('posts.create')],
  }, async (req, reply) => {

    // Private accounts' posts would be hidden from everyone but themselves and admins
    // We aren't free file hosting, so prevent them from making further posts while private
    const uploader = await prisma.user.findUnique({ where: { id: req.user.sub }, select: { private: true } });
    if (!uploader) return reply.status(401).send({ error: 'Unauthorized', hint: 'Account no longer exists' });
    if (uploader.private) {
      return reply.status(403).send({
        error: 'Forbidden',
        hint: 'Private accounts cannot upload. Turn off private mode in your settings to post.',
      });
    }

    const fileKey = crypto.randomUUID();
    const tempPath = path.join(tempDir, fileKey);
    const ignoreLimit = rolePermissionCheck(req.user.roleId, 'limit.upload.ignore');
    const moved: string[] = [];
    let keepFiles = false; // tell finally() to remove any generated/placed files if this try() is aborted.

    try {
      // 1. Stream the upload to disk.
      const upload = await req.file({ limits: { fileSize: ignoreLimit ? Infinity : MAX_UPLOAD_BYTES } });
      if (!upload) { return reply.status(400).send({ error: 'No file provided' }) };

      await pipeline(upload.file, fs.createWriteStream(tempPath));

      if (upload.file.truncated) {
        return reply.status(413).send({ error: 'File too large', hint: `Max size is ${MAX_UPLOAD_BYTES/1024/1024} MB` });
      }

      // 2. Validate the post's fields before doing any heavy work
      const parsed = parseUploadFields(upload);
      if (!parsed.ok) { return reply.status(400).send({ error: `Invalid fields`, hint: parsed.error }) };
      const { safety, sources, notes, tags } = parsed.fields;

      // 3. Validate tags
      const resolvedTags = await resolveTagNames(tags);
      if (resolvedTags.invalid.length) {
        return reply.status(400).send({
          error: 'Invalid tags',
          hint: resolvedTags.invalid.map((i) => `"${i.input}": ${i.reason}`).join(' '),
        });
      }

      // 4. Process file (detect, check, dedupe, thumbs, preview, measure, and move into place)
      const skipDupes = getField(upload, 'skipDupes') === 'true';
      const file = await processUpload(tempPath, fileKey, { roleId: req.user.roleId, skipDupes, moved });

      // 5. Upload-based AutoTagger (if disabled, skips)
      // AGGRESSIVE = always | SELECTIVE = uploader asks and has perms
      let autoTagNames: string[] = [];
      const addons = getServerAddons();
      const wantsAutoTag = addons.autoTaggerMode.includes('AGGRESSIVE')
        || (addons.autoTaggerMode.includes('SELECTIVE')
          && getField(upload, 'autoTag') === 'true'
          && rolePermissionCheck(req.user.roleId, 'posts.autotag'));
      
      if (addons.enableAutoTagger && addons.autoTaggerUrl && wantsAutoTag && file.type !== 'VIDEO') {
        try {
          const { matches } = await autoTagFromThumbnail(fileKey);
          autoTagNames = matches.map((m) => m.tag.name);
        } catch (e) {
          logger.warn(`AutoTagger requested but was skipped for ${fileKey}.`, e);
        }
      }

      // 6. Save the post and its tags together
      const post = await prisma.$transaction(async (tx) => {
        // Resolve again: tags may have been deleted or merged while we were processing
        const { tags: found } = await resolveTagNames(tags, tx);

        const { tags: autoFound } = await resolveTagNames(autoTagNames, tx);
        const tagIds = [...new Set([...found, ...autoFound].map((t) => t.id))];

        const post = await tx.post.create({
          data: {
            ...file,
            uploaderId: req.user.sub,
            fileKey,
            safety,
            sources,
            notes,
            tagCount: tagIds.length,
            tags: { create: tagIds.map((tagId) => ({ tagId })) },
          },
          include: { tags: { select: { tag: { select: { id: true, name: true, categoryId: true } } } } },
          omit: { fileSize: true, previewSize: true }, // JSON can't serialize BigInt
        });

        if (tagIds.length) {
          await tx.tag.updateMany({ where: { id: { in: tagIds } }, data: { postCount: { increment: 1 } } });
        }

        return post;
      });

      keepFiles = true; // tell finally() to keep the post's files. we're done :)
      const { tags: postTags, ...rest } = post;
      return reply.status(201).send({
        ...withAssetUrls(rest, ['originalPath', 'previewPath']),
        tags: postTags.map((t) => t.tag),
      });
    } catch (e) {
      if (e instanceof HttpError) return reply.status(e.status).send(e.body);
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return reply.status(409).send({ error: 'Conflict', hint: 'A tag was created by someone else at the same moment. Please retry.' });
      }
      logger.error('Upload failed', e);
      return reply.status(500).send({ error: 'Upload failed' });
    } finally {
      await cleanupTemp(fileKey); // deletes any stale cache files like video frames
      if (!keepFiles) await discardFiles(moved); // undo any moves if the post wasn't created
    }
  }
)}

export default createPost;