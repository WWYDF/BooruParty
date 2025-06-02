import { exec } from 'child_process';
import { promisify } from 'util';
import { ENCODER_PRIORITY_MAP } from '../types/encoders';

const execAsync = promisify(exec);

let encoderListCache: Set<string> | null = null;
let hwaccelCache: Set<string> | null = null;
const usableEncoderCache: Record<string, string> = {};

async function loadEncoders(): Promise<Set<string>> {
  if (encoderListCache) return encoderListCache;

  const { stdout } = await execAsync('ffmpeg -hide_banner -encoders');
  const matches = stdout.matchAll(/^\s*[A-Z\.]+\s+([a-zA-Z0-9_\-]+)\s/mg);
  encoderListCache = new Set([...matches].map(m => m[1]));
  return encoderListCache;
}

async function loadHwaccels(): Promise<Set<string>> {
  if (hwaccelCache) return hwaccelCache;

  const { stdout } = await execAsync('ffmpeg -hide_banner -hwaccels');
  hwaccelCache = new Set(
    stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('Hardware'))
  );
  return hwaccelCache;
}

async function isUsableEncoder(encoder: string): Promise<boolean> {
  try {
    const testCmd = `ffmpeg -f lavfi -i testsrc -pix_fmt yuv420p -t 1 -c:v ${encoder} -f null - -y -loglevel error`;
    await execAsync(testCmd);
    return true;
  } catch {
    return false;
  }
}

function encoderMatchesHw(encoder: string, hwSet: Set<string>): boolean {
  if (encoder.includes('nvenc')) return hwSet.has('cuda');
  if (encoder.includes('qsv')) return hwSet.has('qsv');
  if (encoder.includes('vaapi')) return hwSet.has('vaapi');
  if (encoder.includes('amf')) return false; // block AMF on Linux
  return true;
}

export async function getBestEncoder(codec: keyof typeof ENCODER_PRIORITY_MAP): Promise<string> {
  const manualOverride = process.env.VIDEO_ENCODER_IMPL;
  if (manualOverride) {
    console.log(`[Encoder] Using manual override: ${manualOverride}`);
    return manualOverride;
  }

  if (usableEncoderCache[codec]) return usableEncoderCache[codec];

  const encoders = await loadEncoders();
  const hwaccels = await loadHwaccels();
  const priorityList = ENCODER_PRIORITY_MAP[codec];

  for (const encoder of priorityList) {
    const hwOkay = encoderMatchesHw(encoder, hwaccels);
    const listed = encoders.has(encoder);
    if (hwOkay && listed) {
      const usable = await isUsableEncoder(encoder);
      if (usable) {
        console.log(`[Encoder] Selected encoder "${encoder}" for codec "${codec}"`);
        usableEncoderCache[codec] = encoder;
        return encoder;
      } else {
        console.log(`[Encoder] Rejected unusable encoder: ${encoder}`);
      }
    }
  }

  throw new Error(`No usable encoder found for codec "${codec}"`);
}
