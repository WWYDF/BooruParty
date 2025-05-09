import fs from 'fs';
import path from 'path';
import { FastifyInstance } from 'fastify';

interface Props {
  filePath: string,
  postId: string,
  previewScale: number | null,
  fastify: FastifyInstance
}

export default function checkDeletePreview(data: Props): boolean {
  const originalSize = fs.statSync(data.filePath).size;
  const previewPath = path.join(process.cwd(), 'data/previews/image', `${data.postId}.webp`);

  if (data.previewScale == null) { return true }

  if (fs.existsSync(previewPath)) {
    const previewSize = fs.statSync(previewPath).size;
    if (data.previewScale === 100 && previewSize >= originalSize) {
      data.fastify.log.warn(`Deleting useless preview for post ${data.postId}`);
      setTimeout(() => {
        try {
          fs.unlinkSync(previewPath);
          data.fastify.log.warn(`Deleted redundant preview: ${previewPath}`);
        } catch (err) {
          data.fastify.log.error(`Failed to delete preview: ${err}`);
        }
      }, 50);
      return true;
    }
  }

  return false;
}