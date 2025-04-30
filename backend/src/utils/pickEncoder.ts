import { exec } from 'child_process';
import { promisify } from 'util';
import { ENCODER_PRIORITY } from '../types/encoders';

const execAsync = promisify(exec);

let cachedEncoder: string | null = null;

export async function getBestH264Encoder(): Promise<string> {
  if (cachedEncoder) return cachedEncoder;

  try {
    const { stdout } = await execAsync('ffmpeg -hide_banner -encoders');
    const availableEncoders = stdout.split('\n').map(line => line.trim());

    for (const encoder of ENCODER_PRIORITY) {
      if (availableEncoders.some(line => line.includes(encoder))) {
        cachedEncoder = encoder;
        return encoder;
      }
    }

    throw new Error('No suitable H.264 encoder found.');
  } catch (err) {
    console.error('Failed to detect FFmpeg encoders:', err);
    return 'libx264'; // Fallback
  }
}
