import { FastifyPluginAsync } from "fastify";
import { appLogger } from "@/core/plugins/logger";
import { requirePermission, rolePermissionCheck } from "@/core/utilities/permissionCache";
import crypto from 'node:crypto';
import path from "node:path";
import { cleanupTemp, detectFileType, tempDir } from "@/components/uploads/receive";
import { pipeline } from 'node:stream/promises';
import fs from "fs";
import { PermissionName } from "@/core/objects/permissions";
import { computePHash, findDuplicate } from "@/components/uploads/dedupe";
import { generateThumbnails } from "@/components/uploads/thumbnails";
import { generatePreview } from "@/components/uploads/previews";
import { probeVideo } from "@/components/uploads/video";
import { getField, parseUploadFields } from "@/components/uploads/fields";
import { discardFiles, getAspectRatio, moveIntoPlace } from "@/components/uploads/finalize";
import { prisma } from "@/core/plugins/prisma";

const logger = appLogger('Posts/Create');
const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_MB ?? 100) * 1024 * 1024;

const createPost: FastifyPluginAsync = async (fastify) => {
  fastify.post('/create', {
    onRequest: [fastify.authenticate, requirePermission('posts.create')],
  }, async (req, reply) => {
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
      const { safety, sources, notes } = parsed.fields;

      // 3. Work out what it really is
      const detected = await detectFileType(tempPath);
      if (!detected) { return reply.status(415).send({ error: 'Unsupported file type' }) };

      // 4. is this user allowed to upload this kind of file?
      const typePerm = `upload.type.${detected.type.toLowerCase()}` as PermissionName;
      if (!rolePermissionCheck(req.user.roleId, typePerm)) { return reply.status(403).send({ error: 'Forbidden', hint: `Missing permission: ${typePerm}` }) };

      // 5. Duplicate check
      const skipDupes = getField(upload, 'skipDupes') === 'true';
      const pHash = await computePHash(tempPath, detected.type);
      const dupeBypass = skipDupes && rolePermissionCheck(req.user.roleId, 'posts.create.dupes');

      if (!dupeBypass) {
        const duplicateOf = await findDuplicate(pHash);
        if (duplicateOf !== null) {
          return reply.status(409).send({ error: 'Duplicate', hint: "This file already exists", duplicateOf });
        }
      }

      // 6. Thumbnails
      await generateThumbnails(tempPath, detected.type, fileKey);

      // 7. Preview
      const videoInfo = detected.type === 'VIDEO' ? await probeVideo(tempPath) : null;
      const preview = await generatePreview(tempPath, detected, fileKey, videoInfo);

      // 8. Final measurements
      const aspectRatio = await getAspectRatio(tempPath, videoInfo);
      const { size: fileSize } = await fs.promises.stat(tempPath);

      // 9. Move everything into place
      const { originalPath, previewPath } = await moveIntoPlace(fileKey, tempPath, detected, preview, moved);

      // 10. Save the post
      const post = await prisma.post.create({
        data: {
          uploaderId: req.user.sub,
          type: detected.type,
          fileKey,
          originalPath,
          previewPath,
          safety,
          sources,
          notes,
          aspectRatio,
          fileSize: BigInt(fileSize),
          previewSize: preview ? BigInt(preview.size) : null,
          duration: videoInfo?.duration ?? null,
          hasAudio: videoInfo?.hasAudio ?? false,
          pHash,
          dupeBypass,
        },
        // select: postSummarySelect
        omit: { fileSize: true, previewSize: true } // JSON can't seriallize BigInt
      });

      keepFiles = true; // tell finally() to keep the post's files. we're done :)
      return reply.status(201).send(post);
    } catch (e) {
      logger.error('Upload failed', e);
      return reply.status(500).send({ error: 'Upload failed' });
    } finally {
      await cleanupTemp(fileKey); // deletes any stale cache files like video frames
      if (!keepFiles) await discardFiles(moved); // undo any moves if the post wasn't created
    }
  }
)}

export default createPost;