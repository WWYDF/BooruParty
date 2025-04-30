import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import Busboy from 'busboy';
import { processPreviewImage } from '../utils/processPreview';
import { generateThumbnails } from '../utils/generateThumbnails';
import { resolveFileType } from '../utils/mediaTypes';

const uploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', async (req, reply) => {
    return new Promise<void>((resolve, reject) => {
      let postId: string | undefined;
      let finalFileName = '';
      let fileFolder = '';
      let filePath = '';
      let previewScale: number | null = null;

      const busboy = Busboy({ headers: req.headers });

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'postId' && /^\d+$/.test(value)) {
          postId = value;
        }
      });

      busboy.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info;

        if (!postId) {
          file.resume();
          return reply.code(400).send({ error: 'Missing postId' });
        }

        const ext = path.extname(filename);
        fileFolder = resolveFileType(ext); // will be 'image', 'animated', 'video', or 'other'

        finalFileName = `${postId}${ext}`;
        filePath = path.join(process.cwd(), 'data/uploads', fileFolder, finalFileName);
        fs.mkdirSync(path.dirname(filePath), { recursive: true });

        const writeStream = fs.createWriteStream(filePath);
        file.pipe(writeStream);

        writeStream.on('finish', async () => {
          fastify.log.info(`✅ File saved: ${filePath}`);

          if (fileFolder === 'image' || fileFolder === 'animated') {
            try {
              previewScale = await processPreviewImage(filePath, Number(postId));
              if (previewScale == null) {
                throw new Error('PreviewScale came back null.');
              }
          
              // 🛠️ ADD THIS CHECK HERE:
              const originalSize = fs.statSync(filePath).size;
              const previewPath = path.join(process.cwd(), 'data/previews/image', `${postId}.webp`);
              if (fs.existsSync(previewPath)) {
                const previewSize = fs.statSync(previewPath).size;
                if (previewScale === 100 && previewSize >= originalSize) {
                  fastify.log.info(`🗑️ Deleting useless preview for post ${postId}`);
                  fs.unlinkSync(previewPath);
                  previewScale = null; // Because there's no good preview now
                }
              }
          
              fastify.log.info(`🖼️ Preview scale = ${previewScale}`);
            } catch (err) {
              fastify.log.error('❌ processPreview failed:', err);
            }
          }

          if (fileFolder === 'image' || fileFolder === 'animated' || fileFolder === 'video') {
            const thumbs = await generateThumbnails(filePath, fileFolder as any, Number(postId));
            fastify.log.info(`🖼️ Generated thumbnails:`, thumbs);
          }

          reply.send({
            status: 'success',
            postId: Number(postId),
            previewScale,
          });
          resolve();
        });

        writeStream.on('error', (err) => {
          fastify.log.error('❌ Write stream error', err);
          reply.code(500).send({ error: 'Failed to save file' });
          resolve();
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
