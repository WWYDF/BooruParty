import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import { appLogger } from '../../../plugins/logger';
import sharp from 'sharp';

const execAsync = promisify(exec);
const logger = appLogger('Animations');

/**
 * Compresses an animated GIF using system-installed gifsicle.
 */
export async function compressGif(
  inputPath: string,
  outputPath: string,
  width: number = 600,
  quality: number = 50
): Promise<void> {
  const cmd = `gifski --quality ${quality} --width ${width} -o "${outputPath}" "${inputPath}"`;

  try {
    await execAsync(cmd);
    if (!fs.existsSync(outputPath)) {
      throw new Error("Gifski failed: no output generated.");
    }
  } catch (err) {
    logger.error("GIF compression failed:", err);
    throw err;
  }
}

/**
 * Creates an animated WEBP using system-installed ffmpeg.
 */
export async function createAnimatedWebp(
  inputPath: string,
  outputPath: string,
  quality: number = 90
): Promise<boolean> {
  const cmd = `ffmpeg -i ${inputPath} -vcodec libwebp -lossless 0 -q:v ${quality} -preset picture -loop 0 ${outputPath}`;

  try {
    await execAsync(cmd);
    if (!fs.existsSync(outputPath)) {
      throw new Error("FFMPEG failed: No output generated.");
    }
    return true;
  } catch (err) {
    logger.error("Animated WEBP compression failed:", err);
    return false;
  }
}

/**
 * Compresses an animated WEBP using built-in Sharp.
 */
export async function compressAnimatedWebp(
  inputBuffer: Buffer,
  outputPath: string,
  qualityOverride?: number,
): Promise<boolean> {
  const maxWidth = 1280;
  const effort = Number(process.env.ANIMATION_COMPRESSION ?? 4);
  const quality = qualityOverride ?? Number(process.env.ANIMATION_QUALITY ?? 80);

  // Single sharp instance
  const image = sharp(inputBuffer, { animated: true, limitInputPixels: false });

  try {
    const meta = await image.metadata();

    if (meta.width && meta.width > maxWidth) { logger.warn( `Resizing animation preview since input width was too large (${meta.width}px > ${maxWidth}px)` );
      // Mutate the same instance as to not re-encode multiple times lol
      image.resize({ width: maxWidth, withoutEnlargement: true });
    }

    logger.verbose(`Compressing animation with quality ${quality} & effort ${effort}...`);

    await image.webp({ quality, loop: 0, effort }).toFile(outputPath);
    
    logger.info(`Successfully compressed animation with Sharp!`);
    return true;
  } catch (error) {
    logger.error(error);
    return false;
  }
}