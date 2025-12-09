import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import Busboy from 'busboy';
import sharp from 'sharp';
import { PreviewFile, resolveFileType } from '../types/mediaTypes';
import { processPreview } from '../utils/processPreview';
import { generateThumbnails, thumbnailSizes } from '../utils/generateThumbnails';
import { getAspectRatio } from '../utils/aspectRatio';
import checkDeletePreview from '../utils/deletePreview';
import { appLogger } from '../plugins/logger';

const logger = appLogger('Replacer');

const postReplaceRoute: FastifyPluginAsync = async (fastify) => {
  //
  // For replacing content entirely
  //
  fastify.post('/replace', { preHandler: fastify.verifySecret }, async (req, reply) => {
    return new Promise<void>((resolve) => {
      let postId: string | undefined;
      let previewData: PreviewFile;

      const busboy = Busboy({ headers: req.headers });

      let fileBuffer: Buffer[] = [];
      let incomingExt = '';
      let incomingMime = '';

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'postId' && /^\d+$/.test(value)) {
          postId = value;
        }
      });

      busboy.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info;
        incomingExt = path.extname(filename);
        incomingMime = mimeType;

        file.on('data', chunk => fileBuffer.push(chunk));
      });

      busboy.on('finish', async () => {
        if (!postId || !fileBuffer.length) {
          return reply.code(400).send({ error: 'Missing postId or file' });
        }

        const idStr = `${postId}`;
        const ext = incomingExt;
        const fileFormat = resolveFileType(ext);
        const filePath = path.join(process.cwd(), 'data/uploads', fileFormat, `${idStr}${ext}`);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });

        // Clean up old versions
        const foldersToClean = [
          `data/uploads/image`,
          `data/uploads/video`,
          `data/uploads/animated`,
          `data/previews/image`,
          `data/previews/animated`,
          `data/thumbnails`,
        ];

        for (const folder of foldersToClean) {
          try {
            const files = await fsp.readdir(folder);
            const matches = files.filter(f => f.startsWith(idStr));
            for (const file of matches) {
              await fsp.unlink(path.join(folder, file)).catch(() => {});
            }
          } catch {}
        }

        const buffer = Buffer.concat(fileBuffer);
        const targetExts = ['.jpg', '.jpeg', '.webp'];
        const shouldStrip = fileFormat === 'image' && targetExts.includes(ext.toLowerCase());

        try {
          if (shouldStrip) {
            await sharp(buffer)
              .rotate()
              .withMetadata({ exif: undefined })
              .toFile(filePath);
          } else {
            await fsp.writeFile(filePath, buffer);
          }

          // Re-generate previews & thumbnails
          let previewScale: number | null = null;
          let ratio: number | null = null;
          let deletedPreview = false;

          try {
            previewData = await processPreview(filePath, Number(postId));
            previewScale = previewScale = previewData.previewScale;
            deletedPreview = checkDeletePreview({filePath, postId, previewScale, fastify})

            ratio = await getAspectRatio(filePath, fileFormat);
            await generateThumbnails(filePath, fileFormat, Number(postId));
          } catch (err) {
            logger.warn(`Preview/Thumbnail generation failed: ${err}`);
          }

          return reply.send({ success: true, previewScale, aspectRatio: ratio, deletedPreview, assignedExt: previewData.assignedExt,});
        } catch (err) {
          logger.error(`Replace failed: ${err}`);
          return reply.code(500).send({ error: 'Failed to replace post file' });
        }
      });

      req.raw.pipe(busboy);
    });
  });


  //
  // For replacing thumbnails on videos
  //
  fastify.post('/replace/thumbnail', { preHandler: fastify.verifySecret }, async (req, reply) => {
    return new Promise<void>((resolve) => {
      let postId: string | undefined;
      const busboy = Busboy({ headers: req.headers });

      let fileBuffer: Buffer[] = [];
      let incomingExt = '';

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'postId' && /^\d+$/.test(value)) {
          postId = value;
        }
      });

      busboy.on('file', (fieldname, file, info) => {
        const { filename } = info;
        incomingExt = path.extname(filename);

        file.on('data', chunk => fileBuffer.push(chunk));
      });

      busboy.on('finish', async () => {
        if (!postId || !fileBuffer.length) {
          return reply.code(400).send({ error: 'Missing postId or file' });
        }

        const idStr = `${postId}`;
        const ext = incomingExt;
        const fileFormat = resolveFileType(ext);

        if (fileFormat !== 'image') { return reply.status(400).send({ success: false, error: "You must provide an IMAGE." }); } 

        // Clean up old versions
        const foldersToClean = [
          `data/thumbnails`,
        ];

        for (const folder of foldersToClean) {
          try {
            const files = await fsp.readdir(folder);
            const matches = files.filter(f => f.startsWith(idStr));
            for (const file of matches) {
              await fsp.unlink(path.join(folder, file)).catch(() => {});
            }
          } catch {}
        }

        const buffer = Buffer.concat(fileBuffer);
        const outputDir = path.join(process.cwd(), 'data/thumbnails');
        fs.mkdirSync(outputDir, { recursive: true });

        try {
          try {
            const results = await Promise.all(
              Object.entries(thumbnailSizes).map(async ([label, width]) => {
                const outPath = path.join(outputDir, `${postId}_${label}.webp`);
                await sharp(buffer)
                  .resize({ width, withoutEnlargement: true })
                  .webp({ quality: 50 })
                  .toFile(outPath);
                return { size: label, path: outPath };
              })
            );
            if (results.length !== 3) { throw new Error('Not all images were processed successfully!') }
          } catch (err) {
            logger.warn(`Preview/Thumbnail generation failed: ${err}`);
            return reply.status(500).send({ success: false });
          }

          return reply.status(200).send({ success: true });
        } catch (err) {
          logger.error(`Replace failed: ${err}`);
          return reply.status(500).send({ error: 'Failed to replace post file' });
        }
      });

      req.raw.pipe(busboy);
    });
  });
};

export default postReplaceRoute;
