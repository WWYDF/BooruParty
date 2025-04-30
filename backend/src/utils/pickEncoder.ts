import { exec } from 'child_process';
import { promisify } from 'util';
import { ENCODER_PRIORITY_MAP } from '../types/encoders';

const execAsync = promisify(exec);

const encoderCache: Record<string, string> = {};

export async function getBestEncoder(codec: 'h264' | 'vp9' | 'av1'): Promise<string> {
  if (encoderCache[codec]) return encoderCache[codec];

  try {
    const { stdout } = await execAsync('ffmpeg -hide_banner -encoders');
    const available = stdout.split('\n').map(line => line.trim());

    const priorityList = ENCODER_PRIORITY_MAP[codec];

    for (const encoder of priorityList) {
      if (available.some(line => line.includes(encoder))) {
        encoderCache[codec] = encoder;
        return encoder;
      }
    }

    throw new Error(`No available encoder found for codec "${codec}"`);
  } catch (err) {
    console.error(`Error detecting encoders for ${codec}:`, err);
    return codec === 'vp9' ? 'libvpx-vp9' : 'libx264'; // fallback
  }
}
