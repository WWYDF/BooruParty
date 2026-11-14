import { FastifyPluginAsync } from "fastify";
import { appLogger } from "@/core/plugins/logger";
import { requirePermission, rolePermissionCheck } from "@/core/utilities/permissionCache";
import crypto from 'node:crypto';
import path from "node:path";
import { cleanupTemp, detectFileType, getField, tempDir } from "@/components/uploads/receive";
import { pipeline } from 'node:stream/promises';
import fs from "fs";
import { PermissionName } from "@/core/objects/permissions";
import { computePHash, findDuplicate } from "@/components/uploads/dedupe";

const logger = appLogger('Posts/Create');
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024;

const createPost: FastifyPluginAsync = async (fastify) => {
  fastify.post('/create', {
    onRequest: [fastify.authenticate, requirePermission('posts.create')],
  }, async (req, reply) => {
    const fileKey = crypto.randomUUID();
    const tempPath = path.join(tempDir, fileKey);
    const ignoreLimit = rolePermissionCheck(req.user.roleId, 'limit.upload.ignore');

    try {
      // 1. Stream the upload to disk.
      const upload = await req.file({ limits: { fileSize: ignoreLimit ? Infinity : MAX_UPLOAD_BYTES } });
      if (!upload) { return reply.status(400).send({ error: 'No file provided' }) };

      await pipeline(upload.file, fs.createWriteStream(tempPath));

      if (upload.file.truncated) {
        return reply.status(413).send({ error: 'File too large', hint: `Max size is ${MAX_UPLOAD_BYTES/1024/1024} MB` });
      }

      // 2. Work out what it really is
      const detected = await detectFileType(tempPath);
      if (!detected) { return reply.status(415).send({ error: 'Unsupported file type' }) };

      // 3. is this user allowed to upload this kind of file?
      const typePerm = `upload.type.${detected.type.toLowerCase()}` as PermissionName;
      if (!rolePermissionCheck(req.user.roleId, typePerm)) { return reply.status(403).send({ error: 'Forbidden', hint: `Missing permission: ${typePerm}` }) };

      // 4. Duplicate check
      const skipDupes = getField(upload, 'skipDupes') === 'true';
      const pHash = await computePHash(tempPath, detected.type);
      const dupeBypass = skipDupes && rolePermissionCheck(req.user.roleId, 'posts.create.dupes');

      if (!dupeBypass) {
        const duplicateOf = await findDuplicate(pHash);
        if (duplicateOf !== null) {
          return reply.status(409).send({ error: 'Duplicate', hint: "This file already exists", duplicateOf });
        }
      }

      // 5. Extract remaining parameters
      

      return reply.status(200).send({ fileKey, ...detected, size: (await fs.promises.stat(tempPath)).size, pHash });
    } catch (e) {
      logger.error('Upload failed', e);
      return reply.status(500).send({ error: 'Upload failed' });
    } finally {
      await cleanupTemp(fileKey);
    }
  }
)}

export default createPost;