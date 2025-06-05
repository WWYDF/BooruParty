import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getBestEncoder } from './pickEncoder';
import { ENCODER_OPTIONS_MAP } from '../types/encoders';

const execAsync = promisify(exec);

export async function processVideoPreview(originalPath: string, postId: number): Promise<number | null> {
  if (process.env.DISABLE_VIDEO_PREVIEWS == 'true') {
    // console.debug('Skipping video encoding.')
    return 100;
  }

  const previewDir = path.join(__dirname, '../../data/previews/video');
  fs.mkdirSync(previewDir, { recursive: true });

  const previewPath = path.join(previewDir, `${postId}.mp4`);
  const encoder = await getBestEncoderFromEnv();
  const encoderConfig = ENCODER_OPTIONS_MAP[encoder];
  if (!encoderConfig) throw new Error(`No config for encoder "${encoder}"`);

  const filters =
  'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709,' +
  'scale=1280:-2';

  const ffmpegCmd = [
    'ffmpeg', '-y',
    '-i', `"${originalPath}"`,
    '-vf', `"${filters}"`,
    '-c:v', encoderConfig.encoder,
    encoderConfig.qualityFlag, encoderConfig.qualityValue,
    ...(encoderConfig.preset  ? ['-preset',  encoderConfig.preset]  : []),
    ...(encoderConfig.profile ? ['-profile:v', encoderConfig.profile] : []),
    ...(encoderConfig.extraArgs || []),
    '-c:a', 'libopus', '-b:a', '128k',
    `"${previewPath}"`
  ].join(' ');
  
  try {
    await execAsync(ffmpegCmd);

    if (!fs.existsSync(previewPath)) {
      throw new Error('FFmpeg did not produce a preview file.');
    }

    const originalSize = fs.statSync(originalPath).size;
    const previewSize = fs.statSync(previewPath).size;

    if (previewSize >= originalSize) {
      fs.unlinkSync(previewPath);
      return 100; // return 100 as the original was smaller so we should just use that
    }

    const previewScale = Math.round((previewSize / originalSize) * 100);
    return previewScale;
  } catch (err) {
    console.error('FFmpeg video preview failed:', err);
    return null;
  }
}


async function getBestEncoderFromEnv(): Promise<string> {
  const override = process.env.ENCODER_OVERRIDE?.trim();

  if (override) {
    if (ENCODER_OPTIONS_MAP[override]) {
      console.log(`[Encoder] Using ENCODER_OVERRIDE: ${override}`);
      return override;
    } else {
      console.warn(`[Encoder] ENCODER_OVERRIDE "${override}" is not valid. Skipping it...`);
      console.warn(`[Encoder] Please refer to https://docs.booru.party/setup/encoders for list of valid encoders.`);
    }
  }

  const envCodec = (process.env.VIDEO_ENCODER || 'h264').toLowerCase();

  if (!['h264', 'vp9', 'av1', 'h265'].includes(envCodec)) {
    console.warn(`Unsupported VIDEO_ENCODER "${envCodec}", falling back to h264`);
  }

  const codec = ['h264', 'vp9', 'av1', 'h265'].includes(envCodec) ? envCodec : 'h264';
  const encoder = await getBestEncoder(codec as 'h264' | 'vp9' | 'av1' | 'h265');

  return encoder;
}