import { requirePermission } from "@/core/utilities/permissionCache";
import { FastifyPluginAsync } from "fastify";
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'fs';
import { cleanupTemp, detectFileType, tempDir } from "@/components/uploads/receive";
import { MAX_AVATAR_BYTES } from "@/core/objects/limits";
import { pipeline } from "node:stream/promises";
import { avatarFilePath, writeAvatar } from "@/components/users/avatars";
import { prisma } from "@/core/plugins/prisma";
import { HttpError } from "@/core/utilities/errors";
import { appLogger } from "@/core/plugins/logger";
import { discardFiles } from "@/components/uploads/finalize";
import { avatarUrl } from "@/core/utilities/reformatters";

const logger = appLogger('Avatars');

const avatars: FastifyPluginAsync = async (fastify) => {

  // Upload a new avatar (multipart, one image)
  fastify.put('/change', {
    onRequest: [fastify.authenticate, requirePermission('profile.edit.avatar')],
  }, async (req, reply) => {
    if (!req.isMultipart()) {
      return reply.status(415).send({ error: 'Unsupported Media Type', hint: 'Send the image as multipart/form-data' });
    }

    const avatarKey = crypto.randomUUID();
    const tempPath = path.join(tempDir, avatarKey);
    let keepFile = false;
    let oldKey: string | null = null;

    try {
      // 1. Stream to temp
      const upload = await req.file({ limits: { fileSize: MAX_AVATAR_BYTES } });
      if (!upload) return reply.status(400).send({ error: 'No file provided' });

      await pipeline(upload.file, fs.createWriteStream(tempPath));
      if (upload.file.truncated) {
        return reply.status(413).send({ error: 'File too large', hint: `Max size is ${MAX_AVATAR_BYTES / 1024 / 1024} MB` });
      }

      // 2. Images only (gifs keep first frame)
      const detected = await detectFileType(tempPath);
      if (!detected || detected.type === 'VIDEO') {
        return reply.status(415).send({ error: 'Unsupported file type', hint: 'Avatars must be an image' });
      }

      // 3. Crop + convert straight into data/avatars
      await writeAvatar(tempPath, avatarKey);

      // 4. Swap the key. Lock the row so two uploads at once each delete the right old file
      oldKey = await prisma.$transaction(async (tx) => {
        const [current] = await tx.$queryRaw<{ avatarKey: string | null }[]>`
          SELECT "avatarKey" FROM "User" WHERE id = ${req.user.sub} FOR UPDATE
        `;
        if (!current) throw new HttpError(401, { error: 'Unauthorized', hint: "You aren't logged in" });

        await tx.user.update({ where: { id: req.user.sub }, data: { avatarKey } });
        return current.avatarKey;
      });

      keepFile = true;
    } catch (e) {
      if (e instanceof HttpError) throw e; // global error handler sends it
      logger.error(`Avatar upload failed for user ${req.user.sub}`, e);
      return reply.status(500).send({ error: 'Avatar upload failed' });
    } finally {
      await cleanupTemp(avatarKey);
      if (!keepFile) await discardFiles([avatarFilePath(avatarKey)]);
    }

    // 5. Old file goes only after commit. A failure here just leaves an orphan, so log it and move on.
    if (oldKey) {
      await discardFiles([avatarFilePath(oldKey)])
        .catch((e) => logger.error(`New avatar saved, but the old one (${oldKey}) could not be removed`, e));
    }

    return reply.status(200).send({ avatar: avatarUrl(avatarKey) });
  })
}

export default avatars;