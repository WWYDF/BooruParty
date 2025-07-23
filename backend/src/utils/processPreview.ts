import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { compressGif } from './processGifs';
import { PreviewFile, resolveFileType } from '../types/mediaTypes';
import { processVideoPreview } from './processVideos';

export async function processPreview(originalPath: string, postId: number): Promise<PreviewFile> {
  const ext = path.extname(originalPath).toLowerCase();
  const fileType = resolveFileType(ext);

  const previewDir = path.join(__dirname, `../../data/previews/${fileType}`);
  fs.mkdirSync(previewDir, { recursive: true });

  const previewPath = path.join(previewDir, `${postId}${fileType === 'animated' ? '.gif' : '.webp'}`);

  if (fileType === 'animated') {
    try {
      await compressGif(originalPath, previewPath);
  
      const originalSize = fs.statSync(originalPath).size;
      const previewSize = fs.statSync(previewPath).size;
  
      if (previewSize >= originalSize) {
        fs.unlinkSync(previewPath); // no benefit
        return { previewScale: null, assignedExt: 'gif' };
      }
  
      return {
        previewScale: Math.round((previewSize / originalSize) * 100),
        assignedExt: 'gif'
      };
    } catch (err) {
      console.error(`Compression failed:`, err);
      return { previewScale: null, assignedExt: null };
    }
  }

  if (fileType === 'video') {
    try {
      const { previewScale, assignedExt } = await processVideoPreview(originalPath, postId);
      return { previewScale, assignedExt };
    } catch (err) {
      console.error('FFmpeg preview failed:', err);
      return { previewScale: null, assignedExt: null };
    }
  }
  

  // Non-GIF logic (e.g., static images, handled by sharp)
  const metadata = await sharp(originalPath).metadata();
  const resizedBuffer = await sharp(originalPath)
    .resize({ width: 1280, withoutEnlargement: true })
    .webp({ quality: 90 })
    .toBuffer();

  await fs.promises.writeFile(previewPath, resizedBuffer);

  // Then use the buffer directly to get metadata
  const resizedMeta = await sharp(resizedBuffer).metadata();
  const previewScale =
    metadata.width && resizedMeta.width
      ? Math.round((resizedMeta.width / metadata.width) * 100)
      : null;

      return { previewScale, assignedExt: 'webp' };
}