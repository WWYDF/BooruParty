import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import Busboy from 'busboy';

const uploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', async (req, reply) => {
    return new Promise<void>((resolve, reject) => {
      let postId: string | undefined;
      let finalFileName = '';
      let fileFolder = '';
      let filePath = '';

      const busboy = Busboy({ headers: req.headers });

      busboy.on('field', (fieldname, value) => {
        if (fieldname === 'postId' && /^\d+$/.test(value)) {
          postId = value;
          fastify.log.info(`📥 Got postId: ${postId}`);
        }
      });

      busboy.on('file', (fieldname, file, info) => {
        const { filename, mimeType } = info;

        if (!postId) {
          file.resume();
          fastify.log.error('❌ postId not set before file');
          return;
        }

        const ext = path.extname(filename);
        fileFolder = mimeType.startsWith('image/') ? 'image'
                   : mimeType.startsWith('video/') ? 'video'
                   : 'other';

        const uploadsDir = path.join(__dirname, '../../uploads', fileFolder);
        fs.mkdirSync(uploadsDir, { recursive: true });

        finalFileName = `${postId}${ext}`;
        filePath = path.join(uploadsDir, finalFileName);

        const writeStream = fs.createWriteStream(filePath);
        file.pipe(writeStream);
      });

      busboy.on('finish', () => {
        fastify.log.info('🧾 Finished streaming. Verifying file...');

        if (!postId || !finalFileName || !fileFolder) {
          reply.code(400).send({ error: 'Missing data (postId or file info)' });
          return resolve();
        }

        if (!fs.existsSync(filePath)) {
          fastify.log.error(`❌ File not found: ${filePath}`);
          reply.code(500).send({ error: 'File failed to save' });
          return resolve();
        }

        fastify.log.info(`✅ File exists: ${filePath}`);
        const url = `/uploads/${fileFolder}/${finalFileName}`;

        reply.send({
          message: 'Upload complete',
          url,
        });
        return resolve();
      });

      req.raw.pipe(busboy);
    });
  });
};

export default uploadRoute;
