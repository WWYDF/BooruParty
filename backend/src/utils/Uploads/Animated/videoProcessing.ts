import path from 'path';
import fs from 'fs';
import { appLogger } from '../../../plugins/logger';
import { ENCODER_OPTIONS_MAP } from '../../../types/encoders';
import { getBestEncoder } from './pickEncoder';
import { spawn } from 'child_process';
import { runFFmpeg, runFFprobe } from './ffInterface';

const logger = appLogger('Encoding');

type VideoPreview = {
  previewScale: number | null,
  assignedExt: 'mp4' | 'webm' | 'mkv' | 'webp' | 'gif' | null, // Just extensions that we encode previews to.
  previewSize?: number
}

export async function processVideoPreview(originalPath: string, postId: number, previewDir: string): Promise<VideoPreview> {
  if (process.env.DISABLE_VIDEO_PREVIEWS == 'true') {
    logger.debug('Skipping video encoding.')
    return { previewScale: 100, assignedExt: null };
  }

  const encoder = await getBestEncoderFromEnv();
  const encoderConfig = ENCODER_OPTIONS_MAP[encoder];
  if (!encoderConfig) throw new Error(`No config for encoder "${encoder}"`);
  const previewPath = path.join(previewDir, `${postId}.${encoderConfig.container}`);

  const encoderFilters = encoderConfig.filters;

  let filters: string;

  const needsQSV = encoderConfig.encoder.includes('qsv');

  if (encoderFilters?.includes('scale_qsv=1280:-1')) {
    const { width: inputW, height: inputH } = await getVideoDimensions(originalPath);
  
    // Round input dimensions to QSV-safe values
    const safeW = roundToMultiple(inputW, 4);
    const safeH = roundToMultiple(inputH, 2);
  
    filters = encoderFilters.replace('scale_qsv=1280:-1', `scale_qsv=${safeW}:${safeH}`);

  } else {
    filters =
      encoderFilters ??
      'setparams=colorspace=bt709:color_primaries=bt709:color_trc=bt709,scale=1280:-2';
  }

  const ffmpegArgs: string[] = [
    '-y',
    ...(needsQSV ? ['-init_hw_device', 'qsv=hw', '-filter_hw_device', 'hw'] : []),
    '-i',
    originalPath,
    '-vf',
    filters,
    '-c:v',
    encoderConfig.encoder,
  ];

  if (encoderConfig.qualityFlag && encoderConfig.qualityValue !== undefined) {
    ffmpegArgs.push(encoderConfig.qualityFlag, String(encoderConfig.qualityValue));
  }

  if (encoderConfig.preset) {
    ffmpegArgs.push('-preset', encoderConfig.preset);
  }

  if (encoderConfig.profile) {
    ffmpegArgs.push('-profile:v', encoderConfig.profile);
  }

  if (encoderConfig.extraArgs && encoderConfig.extraArgs.length) {
    ffmpegArgs.push(...encoderConfig.extraArgs);
  }

  ffmpegArgs.push('-c:a', 'libopus', '-b:a', '128k', previewPath);

  try {
    await runFFmpeg(ffmpegArgs, 'ffmpeg:preview');

    if (!fs.existsSync(previewPath)) {
      throw new Error('FFmpeg did not produce a preview file.');
    }

    const originalSize = fs.statSync(originalPath).size;
    const previewSize = fs.statSync(previewPath).size;

    if (previewSize >= originalSize) {
      fs.unlinkSync(previewPath);
      // Return 100 as the original was smaller so we should just use that
      return { previewScale: 100, assignedExt: encoderConfig.container };
    }

    const previewScale = Math.round((previewSize / originalSize) * 100);
    return { previewScale, assignedExt: encoderConfig.container, previewSize };
  } catch (err) {
    logger.error('FFmpeg video preview failed:', err);
    return { previewScale: null, assignedExt: encoderConfig.container };
  }
}


async function getBestEncoderFromEnv(): Promise<string> {
  const override = process.env.ENCODER_OVERRIDE?.trim();

  if (override) {
    if (ENCODER_OPTIONS_MAP[override]) {
      logger.debug(`[Encoder] Using ENCODER_OVERRIDE: ${override}`);
      return override;
    } else {
      logger.warn(`[Encoder] ENCODER_OVERRIDE "${override}" is not valid. Skipping it...`);
      logger.warn(`[Encoder] Please refer to https://docs.booru.party/setup/encoders for list of valid encoders.`);
    }
  }

  const envCodec = (process.env.VIDEO_ENCODER || 'h264').toLowerCase();

  if (!['h264', 'vp9', 'av1', 'h265'].includes(envCodec)) {
    logger.warn(`Unsupported VIDEO_ENCODER "${envCodec}", falling back to h264`);
  }

  const codec = ['h264', 'vp9', 'av1', 'h265'].includes(envCodec) ? envCodec : 'h264';
  const encoder = await getBestEncoder(codec as 'h264' | 'vp9' | 'av1' | 'h265');

  return encoder;
}

async function getVideoDimensions(filePath: string): Promise<{ width: number; height: number }> {
  const stdout = await runFFprobe(
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'json',
      filePath,
    ],
    'ffprobe:dimensions',
  );

  const info = JSON.parse(stdout);

  if (!info.streams || !info.streams[0]) {
    throw new Error('ffprobe did not return any video streams');
  }

  return {
    width: info.streams[0].width,
    height: info.streams[0].height,
  };
}

function roundToMultiple(value: number, multiple: number): number {
  return Math.ceil(value / multiple) * multiple;
}