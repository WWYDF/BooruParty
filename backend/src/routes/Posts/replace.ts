import { cleanupTemp, tempDir } from "@/components/uploads/receive";
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
import { discardFiles, postFilePaths } from "@/components/uploads/finalize";

const logger = appLogger('Posts/Replace');
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024;

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
}

export default replacePosts;