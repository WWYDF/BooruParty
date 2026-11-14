import { appLogger } from "@/core/plugins/logger";
import { ffmpeg } from "@/core/utilities/ffmpeg";

const logger = appLogger('Encoder');

export type Codec = 'h264' | 'h265' | 'vp9' | 'av1';

export type EncoderConfig = {
  name: string,  // ffmpeg's -c:v value
  codec: Codec,
  container: 'mp4' | 'webm';
  args: string[];  // quality/preset/format flags for this encoder
}

// Within each codec, listed in order of preference: hardware first, software last.
const ENCODERS: EncoderConfig[] = [
  // H.264: plays everywhere
  { name: 'h264_nvenc', codec: 'h264', container: 'mp4',  args: ['-preset', 'p4', '-cq', '30', '-profile:v', 'high', '-pix_fmt', 'yuv420p'] },
  { name: 'h264_qsv',   codec: 'h264', container: 'mp4',  args: ['-preset', 'medium', '-global_quality', '30', '-pix_fmt', 'nv12'] },
  { name: 'h264_amf',   codec: 'h264', container: 'mp4',  args: ['-quality', 'balanced', '-rc', 'cqp', '-qp_i', '28', '-qp_p', '30', '-pix_fmt', 'yuv420p'] },
  { name: 'libx264',    codec: 'h264', container: 'mp4',  args: ['-preset', 'medium', '-crf', '26', '-profile:v', 'high', '-pix_fmt', 'yuv420p'] },

  // H.265: smaller files, but limited browser support (needs the hvc1 tag for Safari)
  { name: 'hevc_nvenc', codec: 'h265', container: 'mp4',  args: ['-preset', 'p7', '-cq', '30', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p'] },
  { name: 'hevc_qsv',   codec: 'h265', container: 'mp4',  args: ['-preset', 'medium', '-global_quality', '28', '-tag:v', 'hvc1', '-pix_fmt', 'nv12'] },
  { name: 'hevc_amf',   codec: 'h265', container: 'mp4',  args: ['-quality', 'quality', '-rc', 'cqp', '-qp_i', '26', '-qp_p', '28', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p'] },
  { name: 'libx265',    codec: 'h265', container: 'mp4',  args: ['-preset', 'medium', '-crf', '26', '-tag:v', 'hvc1', '-pix_fmt', 'yuv420p'] },

  // VP9: plays on any browser from last 10 years, good compression (Recommended)
  { name: 'vp9_qsv',    codec: 'vp9',  container: 'webm', args: ['-preset', 'medium', '-global_quality', '32', '-pix_fmt', 'nv12'] },
  { name: 'libvpx-vp9', codec: 'vp9',  container: 'webm', args: ['-crf', '32', '-b:v', '0', '-deadline', 'realtime', '-cpu-used', '5', '-row-mt', '1', '-pix_fmt', 'yuv420p'] },

  // AV1: smallest files, modern browsers only
  { name: 'av1_nvenc',  codec: 'av1',  container: 'mp4',  args: ['-preset', 'p4', '-cq', '33', '-pix_fmt', 'yuv420p'] },
  { name: 'av1_qsv',    codec: 'av1',  container: 'mp4',  args: ['-preset', 'medium', '-global_quality', '33', '-pix_fmt', 'nv12'] },
  { name: 'libsvtav1',  codec: 'av1',  container: 'mp4',  args: ['-preset', '6', '-crf', '33', '-pix_fmt', 'yuv420p'] },
];

// Shared by the test encode and real previews, so a passing test means real encodes work
export const PREVIEW_SCALE = "scale='min(1280,iw)':-2";
let selected: EncoderConfig | null = null;

// The encoder is chosen at startup, or null if video previews are disabled/unavailable
export function getEncoder(): EncoderConfig | null {
  return selected;
}

// Ecodes 1 second of generated test video with the encoder's REAL settings to make sure it works
async function testEncoder(enc: EncoderConfig): Promise<boolean> {
  try {
    await ffmpeg([
      '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=30',
      '-t', '1',
      '-vf', PREVIEW_SCALE,
      '-c:v', enc.name, ...enc.args,
      '-an', '-f', 'null', '-',
    ], 30 * 1000);
    return true;
  } catch (e) {
    return false;
  }
}

// Call once at startup. Picks the first working encoder for the configured codec.
export async function initializeEncoder() {
  if (process.env.DISABLE_VIDEO_PREVIEWS === 'true') {
    logger.info('[-] Video previews disabled.');
    return;
  }

  logger.warn('[~] Picking a valid encoder for video previews. Please wait...');

  // Exact encoder requested? Use it if it works.
  const override = process.env.ENCODER_OVERRIDE?.trim();
  if (override) {
    const enc = ENCODERS.find((e) => e.name === override);
    if (!enc) {
      logger.warn(`[!] ENCODER_OVERRIDE "${override}" isn't a known encoder. Ignoring it.`);
    } else if (await testEncoder(enc)) {
      selected = enc;
      logger.info(`[+] Using encoder ${enc.name} (${override})`);
      return;
    } else {
      logger.warn(`[!] ENCODER_OVERRIDE "${override}" failed its test encode. Falling back to auto-detection.`);
    }
  }

  // Otherwise, try every encoder for the chosen codec, in order.
  const codec = (process.env.VIDEO_ENCODER ?? 'vp9').toLowerCase() as Codec;
  let candidates = ENCODERS.filter((e) => e.codec === codec);
  if (candidates.length === 0) {
    logger.warn(`[!] Unknown VIDEO_ENCODER "${codec}". Using default (vp9) instead.`);
    candidates = ENCODERS.filter((e) => e.codec === 'vp9');
  }

  for (const enc of candidates) {
    if (await testEncoder(enc)) {
      selected = enc;
      logger.info(`[+] Using encoder ${enc.name} for ${enc.codec}`);
      return;
    }
    logger.debug(`[~] Encoder ${enc.name} unavailable.`);
  }

  // Last resort: libx264 is in nearly every ffmpeg build and plays everywhere
  const fallback = ENCODERS.find((e) => e.name === 'libx264')!;
  if (!candidates.includes(fallback) && await testEncoder(fallback)) {
    selected = fallback;
    logger.warn(`[!] No working ${codec} encoder found. Falling back to libx264.`);
    return;
  }

  logger.warn(`[!] No working encoder found for ${codec}. Video previews disabled.`);
}