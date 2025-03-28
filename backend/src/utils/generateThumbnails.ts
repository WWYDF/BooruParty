import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const sizes = {
  small: 200,
  med: 400,
  large: 800,
};

export async function generateThumbnails(
  filePath: string,
  type: 'image' | 'video' | 'animated',
  postId: number
) {
  const outputDir = path.join(process.cwd(), 'data/thumbnails');
  fs.mkdirSync(outputDir, { recursive: true });

  let framePath = filePath;

  if (type === 'video' || type === 'animated') {
    const tmpFrame = path.join(outputDir, `${postId}_frame.png`);
    // Scary!
    await execAsync(`ffmpeg -y -i "${filePath}" -vf "scale=iw:ih" -frames:v 1 "${tmpFrame}"`);
    framePath = tmpFrame;
  }

  const buffer = fs.readFileSync(framePath);

  const results = await Promise.all(
    Object.entries(sizes).map(async ([label, width]) => {
      const outPath = path.join(outputDir, `${postId}_${label}.webp`);
      await sharp(buffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 90 })
        .toFile(outPath);
      return { size: label, path: outPath };
    })
  );

  // Cleanup temp frame
  if (framePath !== filePath) fs.unlinkSync(framePath);

  return results;
}