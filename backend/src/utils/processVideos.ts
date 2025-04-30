import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getBestEncoder } from './pickEncoder';
import { PRESET_MAP } from '../types/encoders';

const execAsync = promisify(exec);

export async function processVideoPreview(originalPath: string, postId: number): Promise<{ previewScale: number | null, previewPath: string }> {
  const previewDir = path.join(__dirname, '../../data/previews/video');
  fs.mkdirSync(previewDir, { recursive: true });

  const previewPath = path.join(previewDir, `${postId}.mp4`);
  const encoder = await getBestEncoderFromEnv();
  const preset = PRESET_MAP[encoder] || 'fast';


  const ffmpegCmd = `
    ffmpeg -y
    -i "${originalPath}"
    -vf "scale=1280:-2"
    -c:v ${encoder}
    -crf 33
    -b:v 0
    -preset ${preset}
    -c:a libopus
    -b:a 128k
    "${previewPath}"
  `.replace(/\s+/g, ' ').trim();

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


async function getBestEncoderFromEnv(): Promise<string> {
  const envCodec = (process.env.VIDEO_ENCODER || 'h264').toLowerCase();

  if (!['h264', 'vp9', 'av1'].includes(envCodec)) {
    console.warn(`Unsupported VIDEO_ENCODER "${envCodec}", falling back to h264`);
  }

  const codec = ['h264', 'vp9', 'av1'].includes(envCodec) ? envCodec : 'h264';
  const encoder = await getBestEncoder(codec as 'h264' | 'vp9' | 'av1');

  return encoder;
}