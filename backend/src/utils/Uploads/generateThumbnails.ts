import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SubFileUpload } from '../../types/uploadTypes';
import { appLogger } from '../../plugins/logger';

const logger = appLogger('Thumbnails');

const execAsync = promisify(exec);

export const thumbnailSizes = {
  small: 400,
  med: 800,
  large: 1200,
};

const thumbFilters =
  'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709,' +
  'scale=iw:ih';

export async function generateThumbnails(subFile: SubFileUpload) {
  try {
    const outputDir = path.join(process.cwd(), 'data/thumbnails');
    let framePath = subFile.ogPath;

    if (subFile.type === 'video' || subFile.type === 'animated') {
      const tmpFrame = path.join(outputDir, `${subFile.postId}_frame.png`);
      // Scary!
      await execAsync( `ffmpeg -y -i "${subFile.ogPath}" -vf "${thumbFilters}" -frames:v 1 "${tmpFrame}"`);
      framePath = tmpFrame;
    }

    const buffer = fs.readFileSync(framePath);

    const results = await Promise.all(
      Object.entries(thumbnailSizes).map(async ([label, width]) => {
        const outPath = path.join(outputDir, `${subFile.postId}_${label}.webp`);
        await sharp(buffer)
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: 50 })
          .toFile(outPath);
        return { size: label, path: outPath };
      })
    );

    // Cleanup temp frame
    if (framePath !== subFile.ogPath) fs.unlinkSync(framePath);

    return results;
  } catch (error) {
    logger.error('Something went wrong while generating thumbnails!', error);
  }
}