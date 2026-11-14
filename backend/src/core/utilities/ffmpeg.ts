import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

// Runs ffmpeg with the given args. Throws (with ffmpeg's error output) on failure or timeout.
export async function ffmpeg(args: string[], timeoutMs = 10*60*1000): Promise<void> {
  const isDevelopment = process.env.MODE === 'DEVELOPMENT';
  await execFileAsync('ffmpeg', [
    '-hide_banner',
    '-loglevel', isDevelopment ? 'info' : 'error',
    '-y',
    ...args
  ], {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
}

// Runs ffprobe and returns its stdout.
export async function ffprobe(args: string[], timeoutMs = 30_000): Promise<string> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    ...args,
  ], {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}