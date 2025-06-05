import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const TEMP_DIR = path.join(process.cwd(), 'data/temp/');
fs.mkdirSync(TEMP_DIR, { recursive: true });

export async function extractVideoFrame(file: Buffer, ext: string): Promise<Buffer> {
  const tmpName = `frame-src-${Date.now()}.${ext}`;
  const tmpPath = path.join(TEMP_DIR, tmpName);
  await fs.promises.writeFile(tmpPath, file);

  const filters = 'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709,' +
  'thumbnail,scale=320:-1,format=yuvj420p';

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', tmpPath,
      '-frames:v', '1',
      '-vf', filters,
      '-vcodec', 'mjpeg',           // or png, webp, etc.
      '-q:v', '2',                  // quality tweak – lower is better
      '-f', 'image2',
      'pipe:1'
    ]);

    const chunks: Buffer[] = [];

    ffmpeg.stdout.on('data', chunk => chunks.push(chunk));
    ffmpeg.stderr.on('data', err => {
      console.error('🟥 FFmpeg stderr:', err.toString());
    });

    ffmpeg.on('error', reject);

    ffmpeg.on('close', (code) => {
      fs.unlink(tmpPath, () => {}); // Always clean up

      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`FFmpeg failed with code ${code}`));
      }
    });

    ffmpeg.stdin.end(); // not used, input is from file
  });
}
