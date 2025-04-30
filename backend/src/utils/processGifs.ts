import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * Compresses an animated GIF using system-installed gifsicle.
 */
export async function compressGif(
  inputPath: string,
  outputPath: string,
  width: number = 900,
  colors: number = 96,
  lossy: number = 80
): Promise<void> {
  const command = `gifsicle --lossy=${lossy} --resize-width ${width} --colors ${colors} -O3 "${inputPath}" -o "${outputPath}"`;

  try {
    await execAsync(command);

    if (!fs.existsSync(outputPath)) {
      throw new Error('gifsicle did not produce an output file.');
    }
  } catch (err) {
    console.error('Failed to compress GIF with gifsicle:', err);
    throw err;
  }
}
