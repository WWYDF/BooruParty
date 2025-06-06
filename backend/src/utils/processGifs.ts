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
    console.error("GIF compression failed:", err);
    throw err;
  }
}