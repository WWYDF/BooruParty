import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);

/**
 * Gets aspect ratio for images, animated images, or videos
 */
export async function getAspectRatio(filePath: string, fileType: 'image' | 'animated' | 'video' | 'other'): Promise<number> {
  if (fileType === 'image') {
    const { width, height } = await sharp(filePath).metadata();
    if (!width || !height) throw new Error("Sharp failed to get image dimensions");
    return parseFloat((width / height).toFixed(6));
  }

  if (fileType === 'animated' || fileType === 'video') {
    const cmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${filePath}"`;
    const { stdout } = await execAsync(cmd);
    const [width, height] = stdout.trim().split(',').map(Number);
    if (!width || !height) throw new Error("ffprobe failed to get video dimensions");
    return parseFloat((width / height).toFixed(6));
  }

  throw new Error(`Unsupported fileType: ${fileType}`);
}