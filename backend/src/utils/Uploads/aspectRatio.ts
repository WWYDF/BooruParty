import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { SubFileUpload } from '../../types/uploadTypes';
import { appLogger } from '../../plugins/logger';
const execAsync = promisify(exec);

const logger = appLogger('AspectRatio');

/**
 * Gets aspect ratio for images, animated images, or videos
 */
export async function getAspectRatio(subFile: SubFileUpload): Promise<number> {
  try {
    if (subFile.type === 'image') {
      const { width, height } = await sharp(subFile.ogPath).metadata();
      if (!width || !height) throw new Error("Sharp failed to get image dimensions");
      return parseFloat((width / height).toFixed(6));
    }

    if (subFile.type === 'animated' || subFile.type === 'video') {
      const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${subFile.ogPath}"`;
      const { stdout } = await execAsync(cmd);
      const [width, height] = stdout.trim().split(',').map(Number);
      if (!width || !height) throw new Error("ffprobe failed to get video dimensions");
      return parseFloat((width / height).toFixed(6));
    }

    throw new Error(`Unsupported fileType: ${subFile.type}`);
  } catch (error) {
    logger.error(`Something went wrong while fetching the file's aspect ratio!`, error);
    return 0;
  }
}