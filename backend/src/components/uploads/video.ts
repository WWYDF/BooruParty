import { ffmpeg, ffprobe } from "@/core/utilities/ffmpeg";
import { EncoderConfig, PREVIEW_SCALE } from "./encoders";
import { appLogger } from "@/core/plugins/logger";

const logger = appLogger('Video');

export type VideoInfo = {
  duration: number, // seconds
  hasAudio: boolean,
  width: number,
  height: number,
};

// Reads duration, audio tracks, and display dimensions with ffprobe
export async function probeVideo(filePath: string): Promise<VideoInfo> {
  const stdout = await ffprobe([
    '-show_entries', 'format=duration:stream=codec_type,width,height:stream_side_data=rotation:stream_tags=rotate',
    '-of', 'json',
    filePath,
  ]);
  const data = JSON.parse(stdout);
  const streams: any[] = data.streams ?? [];

  const video = streams.find((s) => s.codec_type === 'video');
  if (!video) throw new Error('File has no video stream');

  // Phones store portrait video as landscape plus a "rotate 90" flag for some fuckass reason
  const rotation = Math.abs(Number(video.side_data_list?.[0]?.rotation ?? video.tags?.rotate ?? 0));
  const sideways = rotation === 90 || rotation === 270;

  return {
    duration: Number(data.format?.duration ?? 0),
    hasAudio: streams.some((s) => s.codec_type === 'audio'),
    width: sideways ? video.height : video.width,
    height: sideways ? video.width : video.height,
  }
}


// Encodes a browser-friendly preview with the encoder picked at startup
export async function encodeVideoPreview(inputPath: string, outputPath: string, enc: EncoderConfig, hasAudio: boolean) {
  logger.debug(`Encoding ${enc.codec} for ${outputPath} (hasAudio: ${hasAudio})`);
  const audioArgs = !hasAudio
    ? ['-an']
    : enc.container === 'mp4'
      ? ['-c:a', 'aac', '-b:a', '128k']
      : ['-c:a', 'libopus', '-b:a', '128k'];

  const containerArgs = enc.container === 'mp4' ? ['-movflags', '+faststart'] : [];

  await ffmpeg([
    '-i', inputPath,
    '-vf', PREVIEW_SCALE,
    '-c:v', enc.name, ...enc.args,
    ...audioArgs,
    '-sn', '-dn',
    ...containerArgs,
    outputPath
  ]);
}

// Convert short, muted videos to animations
export function shouldConvertToAnimation(info: VideoInfo): boolean {
  return !info.hasAudio && info.duration > 0 && info.duration <= 5; // 5 seconds max
}

export async function convertToAnimatedWebp(inputPath: string, outputPath: string) {
  logger.debug(`Converting short, silent video to animated webp: ${outputPath}`);
  await ffmpeg([
    '-i', inputPath,
    '-c:v', 'libwebp_anim',
    '-lossless', '0',
    '-q:v', '80',
    '-loop', '0',
    '-an', '-sn', '-dn',
    outputPath,
  ]);
}
//