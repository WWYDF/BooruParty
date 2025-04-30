import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getBestH264Encoder } from './pickEncoder';

const execAsync = promisify(exec);

export async function processVideoPreview(originalPath: string, postId: number): Promise<{ previewScale: number | null, previewPath: string }> {
  const previewDir = path.join(__dirname, '../../data/previews/video');
  fs.mkdirSync(previewDir, { recursive: true });

  const previewPath = path.join(previewDir, `${postId}.mp4`);
  const encoder = await getBestH264Encoder();

  const ffmpegCmd =
    `ffmpeg -y ` +
    `-i "${originalPath}" ` +
    `-vf "scale=1280:-2" ` +
    `-c:v ${encoder} ` +
    `-crf 28 ` +
    `-preset fast ` +
    `-movflags +faststart ` +
    `-c:a aac ` +
    `-b:a 128k ` +
    `"${previewPath}"`;

  try {
    await execAsync(ffmpegCmd);

    if (!fs.existsSync(previewPath)) {
      throw new Error('FFmpeg did not produce a preview file.');
    }

    const originalSize = fs.statSync(originalPath).size;
    const previewSize = fs.statSync(previewPath).size;

    if (previewSize >= originalSize) {
      fs.unlinkSync(previewPath);
      return { previewScale: null, previewPath: '' };
    }

    const previewScale = Math.round((previewSize / originalSize) * 100);
    return { previewScale, previewPath };
  } catch (err) {
    console.error('FFmpeg video preview failed:', err);
    return { previewScale: null, previewPath: '' };
  }
}
