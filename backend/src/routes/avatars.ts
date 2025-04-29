import { FastifyPluginAsync } from 'fastify';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';

const avatarUploadRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/avatars', async function (req, reply) {
    const parts = req.parts();
    let userId: string | null = null;
    let avatarBuffer: Buffer | null = null;

    for await (const part of parts) {
        if (part.type === 'file') {
        if (!part.mimetype.startsWith('image/')) {
            return reply.code(400).send({ error: 'Invalid file type' });
        }

        avatarBuffer = await part.toBuffer();
        } else if (part.type === 'field' && part.fieldname === 'userId') {
        userId = part.value as string;
        }
    }

    if (!userId || !avatarBuffer) {
        return reply.code(400).send({ error: 'Missing userId or file' });
    }

    const timestamp = Date.now();
    const filename = `${userId}_${timestamp}.webp`;
    const outputPath = path.join(process.cwd(), 'data', 'avatars', filename);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });

    await sharp(avatarBuffer)
           .resize(256, 256)
           .webp({ quality: 90 })
           .toFile(outputPath);

    return { success: true, url: `/avatars/${filename}` };
    });
};

export default avatarUploadRoute;