import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEMP_DIR = path.join(process.cwd(), 'data/temp/');
fs.mkdirSync(TEMP_DIR, { recursive: true });

export async function extractVideoFrame(file: Buffer, ext: string): Promise<Buffer> {
  const tmpName = `frame-src-${Date.now()}.${ext}`;
  const tmpPath = path.join(TEMP_DIR, tmpName);

  await fs.promises.writeFile(tmpPath, file);

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-ss', '00:00:01', // start 1s in
      '-i', tmpPath,
      '-frames:v', '1',
      '-vf', 'thumbnail,scale=320:-1',
      '-f', 'image2',
      '-vcodec', 'mjpeg',
      'pipe:1'
    ]);

    const chunks: Buffer[] = [];

    ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
    ffmpeg.stderr.on('data', err => {
      console.error('🟥 FFmpeg stderr:', err.toString());
    });

    ffmpeg.on('error', reject);

    ffmpeg.on('close', (code) => {
      fs.unlink(tmpPath, () => {}); // ✅ always clean up

      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });

    ffmpeg.stdin.end(); // not used, input is from file
  });
}
