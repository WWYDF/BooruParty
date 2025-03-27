import { FastifyPluginAsync } from 'fastify';
import fs from 'fs';
import path from 'path';
import { saveFile } from '../utils/saveFile';
import type { MultipartFile } from '@fastify/multipart';

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', async (req, reply) => {
    const data: MultipartFile | undefined = await req.file();

    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const { filename, mimetype, file } = data;

    const isImage = mimetype.startsWith('image/');
    const isVideo = mimetype.startsWith('video/');
    if (!isImage && !isVideo) {
      return reply.code(400).send({ error: 'Invalid file type' });
    }

    const folder = isImage ? 'image' : 'video';
    const targetDir = path.join(__dirname, '../../uploads', folder);
    fs.mkdirSync(targetDir, { recursive: true });

    const finalName = await saveFile(file, filename, targetDir);

    return reply.send({
      message: 'Upload successful',
      url: `/uploads/${folder}/${finalName}`,
    });
  });
};

export default uploadRoutes;
