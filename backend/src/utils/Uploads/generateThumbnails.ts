import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const thumbnailSizes = {
  small: 400,
  med: 800,
  large: 1200,
};

const thumbFilters =
  'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709,' +
  'scale=iw:ih';

export async function generateThumbnails(
  filePath: string,
  type: 'image' | 'video' | 'animated' | 'other',
  postId: number
) {
  const outputDir = path.join(process.cwd(), 'data/thumbnails');
  fs.mkdirSync(outputDir, { recursive: true });

  let framePath = filePath;

  if (type === 'video' || type === 'animated') {
    const tmpFrame = path.join(outputDir, `${postId}_frame.png`);
    // Scary!
    await execAsync( `ffmpeg -y -i "${filePath}" -vf "${thumbFilters}" -frames:v 1 "${tmpFrame}"`);
    framePath = tmpFrame;
  }

  const buffer = fs.readFileSync(framePath);

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

  // Cleanup temp frame
  if (framePath !== filePath) fs.unlinkSync(framePath);

  return results;
}