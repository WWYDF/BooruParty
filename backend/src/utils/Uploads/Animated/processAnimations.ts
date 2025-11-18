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
  quality: number = 80
): Promise<boolean> {

  await sharp(inputBuffer, { animated: true })
    .webp({ quality, loop: 0, effort: 5 })
    .toFile(outputPath)
    .then(() => logger.info(`Successfully compressed animation with Sharp!`))
    .catch((e) => { logger.error(e); return false; });

  return true;
}