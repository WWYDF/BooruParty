import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import Busboy from 'busboy';
import sharp from 'sharp';
import { processPreview } from '../utils/Uploads/processPreview';
import { generateThumbnails } from '../utils/Uploads/generateThumbnails';
import { PreviewFile, resolveFileType } from '../types/mediaTypes';
import { getAspectRatio } from '../utils/Uploads/aspectRatio';
import { appLogger } from '../plugins/logger';

const logger = appLogger('Uploader');

const uploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', async (req, reply) => {
    return new Promise<void>((resolve, reject) => {
      let postId: string | undefined;
      let finalFileName = '';
      let fileFormat = '';
      let filePath = '';
      let previewScale: number | null = null;
      let ratio: number | null = null;
      let previewData: PreviewFile;

      const busboy = Busboy({ headers: req.headers });

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'postId' && /^\d+$/.test(value)) {
          postId = value;
        }
      });

      busboy.on('file', (fieldname, file, info) => {
        const { filename } = info;

        if (!postId) {
          file.resume();
          return reply.code(400).send({ error: 'Missing postId' });
        }

        const ext = path.extname(filename);
        fileFormat = resolveFileType(ext); // will be 'image', 'animated', 'video', or 'other'

        finalFileName = `${postId}${ext}`;
        filePath = path.join(process.cwd(), 'data/uploads', fileFormat, finalFileName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });

        const targetExts = ['.jpg', '.jpeg', '.webp', '.avif'];
        const shouldStrip = fileFormat === 'image' && targetExts.includes(ext.toLowerCase());

        const chunks: Buffer[] = [];

        file.on('data', (chunk) => chunks.push(chunk));

        file.on('end', async () => {
          const buffer = Buffer.concat(chunks);

          try {
            if (shouldStrip) {
              await sharp(buffer)
                .rotate()
                .withMetadata({ exif: undefined })
                .toFile(filePath);
            } else {
              await fs.promises.writeFile(filePath, buffer);
            }

            logger.info(`File saved: ${filePath}`);
            let deletedPreview = false;

            if (fileFormat === 'image' || fileFormat === 'animated' || fileFormat === 'video') {
              try {
                previewData = await processPreview(filePath, Number(postId));
                previewScale = previewData.previewScale;
                if (previewScale == null) throw new Error('PreviewScale came back null.');

                try {
                  ratio = await getAspectRatio(filePath, fileFormat);
                } catch (err) {
                  logger.warn(`Media reported no aspect ratio: ${err}`);
                }

                const originalSize = fs.statSync(filePath).size;
                const previewPath = path.join(process.cwd(), 'data/previews/image', `${postId}.webp`);

                if (fs.existsSync(previewPath)) {
                  const previewSize = fs.statSync(previewPath).size;
                  if (previewScale === 100 && previewSize >= originalSize) {
                    logger.warn(`Deleting useless preview for post ${postId}`);
                    setTimeout(() => {
                      try {
                        fs.unlinkSync(previewPath);
                        logger.warn(`Deleted redundant preview: ${previewPath}`);
                      } catch (err) {
                        logger.error(`Failed to delete preview: ${err}`);
                      }
                    }, 50);
                    previewScale = null;
                    deletedPreview = true;
                  }
                }

                logger.debug(`Preview scale = ${previewScale}`);
              } catch (err) {
                logger.error(`processPreview failed with ${err}`);
              }

              const thumbs = await generateThumbnails(filePath, fileFormat as any, Number(postId));
              logger.verbose(`Generated thumbnails:`, thumbs);
            }

            reply.send({
              status: 'success',
              postId: Number(postId),
              previewScale,
              aspectRatio: ratio,
              deletedPreview,
              assignedExt: previewData.assignedExt,
            });
            resolve();
          } catch (err) {
            logger.error(`File handling failed: ${err}`);
            reply.code(500).send({ error: 'Failed to process upload' });
            resolve();
          }
        });
      });

      busboy.on('finish', () => {
        if (!filePath) {
          reply.code(400).send({ error: 'No file received' });
          resolve();
        }
      });

      req.raw.pipe(busboy);
    });
  });
};

export default uploadRoute;
