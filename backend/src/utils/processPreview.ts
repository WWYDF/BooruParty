import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { prisma } from "../plugins/prisma";

export async function processPreviewImage(originalPath: string, postId: number) {
  const previewDir = path.join(__dirname, '../../previews/image');
  fs.mkdirSync(previewDir, { recursive: true });

  const previewPath = path.join(previewDir, `${postId}.webp`);

  // Load original metadata
  const metadata = await sharp(originalPath).metadata();

  const resized = sharp(originalPath)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 90 });

  await resized.toFile(previewPath);

  // Get final size after resizing
  const resizedMeta = await sharp(previewPath).metadata();

  const previewScale =
    metadata.width && resizedMeta.width
      ? Math.round((resizedMeta.width / metadata.width) * 100)
      : null;

  await prisma.posts.update({
    where: { id: postId },
    data: { previewScale },
  });

  return {
    previewPath,
    previewScale,
  };
}
