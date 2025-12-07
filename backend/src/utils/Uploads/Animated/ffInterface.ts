import { spawn } from "child_process";
import { appLogger } from "../../../plugins/logger";

const logger = appLogger('FFMPEG');

export async function runFFmpeg(args: string[], label = 'ffmpeg'): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      logger.debug(`[${label}] ${text.trim()}`);
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `${label} exited with code ${code ?? 'null'}${stderr ? `: ${stderr}` : ''}`,
          ),
        );
      }
    });
  });
}

export async function runFFprobe(args: string[], label = 'ffprobe'): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      logger.debug(`[${label}] ${text.trim()}`);
    });

    proc.on('error', (err) => {
      reject(err);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `${label} exited with code ${code ?? 'null'}${stderr ? `: ${stderr}` : ''}`,
          ),
        );
      }
    });
  });
}
