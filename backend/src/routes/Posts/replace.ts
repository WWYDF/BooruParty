import { cleanupTemp, detectFileType, tempDir } from "@/components/uploads/receive";
import { appLogger } from "@/core/plugins/logger";
import { prisma } from "@/core/plugins/prisma";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";
import { FastifyPluginAsync } from "fastify";
import { pipeline } from "node:stream/promises";
import crypto from "node:crypto";
import path from "node:path";
import fs from "fs";
import { getField } from "@/components/uploads/fields";
import { processUpload } from "@/components/uploads/process";
import { HttpError } from "@/core/utilities/errors";
import { discardFiles, moveThumbnails, postFilePaths, thumbnailFilePaths } from "@/components/uploads/finalize";
import { generateThumbnails } from "@/components/uploads/thumbnails";

const logger = appLogger('Posts/Replace');
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024; // 100 MB
const MAX_THUMBNAIL_BYTES = 20 * 1024 * 1024; // 20 MB

const replacePosts: FastifyPluginAsync = async (fastify) => {
  fastify.put('/:id/file', {
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

    // Check permissions BEFORE reading the body, so we don't have to write to disk if invalid
    const post = await prisma.post.findUnique({ where: { id }, select: { uploaderId: true } });
    if (!post) return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });

    const isOwner = post.uploaderId === req.user.sub;
    const allowed = rolePermissionCheck(req.user.roleId, 'posts.edit.others')
      || (isOwner && rolePermissionCheck(req.user.roleId, 'posts.edit.own'));

    if (!allowed) {
      return reply.status(403).send({ error: 'Forbidden', hint: `Missing permission: ${isOwner ? 'posts.edit.own' : 'posts.edit.others'}` });
    }

    const fileKey = crypto.randomUUID(); // new key = new URLs (old files stay untouched until commit)
    const tempPath = path.join(tempDir, fileKey);
    const ignoreLimit = rolePermissionCheck(req.user.roleId, 'limit.upload.ignore');
    const moved: string[] = [];
    let keepFiles = false;
    let oldFiles: string[] = [];

    try {
      // 1. Stream upload to disk
      const upload = await req.file({ limits: { fileSize: ignoreLimit ? Infinity : MAX_UPLOAD_BYTES } });
      if (!upload) return reply.status(400).send({ error: 'No file provided' });

      await pipeline(upload.file, fs.createWriteStream(tempPath));

      if (upload.file.truncated) {
        return reply.status(413).send({ error: 'File too large', hint: `Max size is ${MAX_UPLOAD_BYTES/1024/1024} MB` });
      }

      // 2. Same pipeline as create, but this post can't be its own duplicate, regardless of permission
      const skipDupes = getField(upload, 'skipDupes') === 'true';
      const file = await processUpload(tempPath, fileKey, { roleId: req.user.roleId, skipDupes, ignoreDupeOf: id, moved });

      // 3. Swap the post over to the new files
      oldFiles = await prisma.$transaction(async (tx) => {
        // Lock the row and read its CURRENT files. If someone replaced it while we were processing,
        // these are the ones that are now stale, not the ones we saw at the start of the function.
        const [current] = await tx.$queryRaw<{ fileKey: string, thumbKey: string | null, originalPath: string, previewPath: string | null }[]>`
          SELECT "fileKey", "thumbKey", "originalPath", "previewPath" FROM "Post" WHERE id = ${id} FOR UPDATE
        `;
        if (!current) throw new HttpError(404, { error: 'Not found', hint: 'No post with that id' });

        await tx.post.update({
          where: { id },
          data: { ...file, fileKey, thumbKey: null, updatedAt: new Date() },
        });

        return postFilePaths(current);
      });

      keepFiles = true;
    } catch (e) {
      if (e instanceof HttpError) return reply.status(e.status).send(e.body);
      logger.error(`Replacing file for post ${id} failed`, e);
      return reply.status(500).send({ error: 'Replace failed' });
    } finally {
      await cleanupTemp(fileKey);
      if (!keepFiles) await discardFiles(moved); // new files go if the swap didnt happen
    }

    // 4. Old files go only after the commit
    try {
      logger.debug(`Deleting previous post files...`);
      await discardFiles(oldFiles);
    } catch (e) {
      logger.error(`Post ${id} replaced, but some old files could not be removed`, e);
    }

    return reply.status(204).send();
  });

  fastify.put('/:id/thumbnail', {
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

    const post = await prisma.post.findUnique({ where: { id }, select: { uploaderId: true }});
    if (!post) return reply.status(404).send({ error: 'Not found', hint: 'No post with that id' });

    const isOwner = post.uploaderId === req.user.sub;
    const allowed = rolePermissionCheck(req.user.roleId, 'posts.edit.others')
      || (isOwner && rolePermissionCheck(req.user.roleId, 'posts.edit.own'));

    if (!allowed) {
      return reply.status(403).send({ error: 'Forbidden', hint: `Missing permission: ${isOwner ? 'posts.edit.own' : 'posts.edit.others'}` });
    }

    const thumbKey = crypto.randomUUID(); // new key = new URLs, so cached old thumbnails dont stick around
    const tempPath = path.join(tempDir, thumbKey);
    const moved: string[] = [];
    let keepFiles = false;
    let oldFiles: string[] = [];

    try {
      // 1. Stream to temp
      const upload = await req.file({ limits: { fileSize: MAX_THUMBNAIL_BYTES } });
      if (!upload) return reply.status(400).send({ error: 'No file provided' });

      await pipeline(upload.file, fs.createWriteStream(tempPath));

      if (upload.file.truncated) {
        return reply.status(413).send({ error: 'File too large', hint: `Max size is ${MAX_THUMBNAIL_BYTES/1024/1024} MB` });
      }

      // 2. Images only
      const detected = await detectFileType(tempPath);
      if (!detected || detected.type !== 'IMAGE') {
        return reply.status(415).send({ error: 'Unsupported file type', hint: 'Thumbnails must be an image' });
      }

      // 3. Same sizes and format as the automatic ones, under the new key
      await generateThumbnails(tempPath, detected.type, thumbKey);
      await moveThumbnails(thumbKey, moved);

      // 4. Point the post at them
      oldFiles = await prisma.$transaction(async (tx) => {
        // lock row
        const [current] = await tx.$queryRaw<{ thumbKey: string | null }[]>`
          SELECT "thumbKey" FROM "Post" WHERE id = ${id} FOR UPDATE
        `;
        if (!current) throw new HttpError(404, { error: 'Not found', hint: 'No post with that id' });

        await tx.post.update({ where: { id }, data: { thumbKey, updatedAt: new Date() }});

        // Only delete current custom thumbnails. Original generated ones always stick around.
        return current.thumbKey ? thumbnailFilePaths(current.thumbKey) : [];
      });

      keepFiles = true;
    } catch (e) {
      if (e instanceof HttpError) return reply.status(e.status).send(e.body);
      logger.error(`Replacing thumbnail for post ${id} failed`, e);
      return reply.status(500).send({ error: 'Thumbnail replace failed' });
    } finally {
      await cleanupTemp(thumbKey);
      if (!keepFiles) await discardFiles(moved);
    }

    try {
      logger.debug(`Cleaning up any previous custom thumbnails...`);
      await discardFiles(oldFiles);
    } catch (e) {
      logger.error(`Post ${id} thumbnail replaced, but the old custom thumbnail could not be removed.`);
    }

    return reply.status(204).send();
  });
}

export default replacePosts;