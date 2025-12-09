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

export async function runFFprobe(
  args: string[],
  label = 'ffprobe',
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const { timeoutMs, signal } = options;

  return new Promise<string>((resolve, reject) => {
    const proc = spawn('ffprobe', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    const safeKill = () => {
      if (!proc.killed) {
        try {
          proc.kill('SIGKILL');
        } catch {
          // ignore
        }
      }
    };

    const cleanup = () => {
      proc.stdout.removeAllListeners();
      proc.stderr.removeAllListeners();
      proc.removeAllListeners();
      if (signal) signal.removeEventListener('abort', onAbort);
      if (timeoutId) clearTimeout(timeoutId);
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      safeKill();
      cleanup();
      reject(err);
    };

    const onAbort = () => {
      fail(new Error(`${label} aborted`));
    };

    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        fail(new Error(`${label} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    if (signal) {
      if (signal.aborted) return onAbort();
      signal.addEventListener('abort', onAbort);
    }

    proc.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      logger.debug(`[${label}] ${text.trim()}`);
    });

    proc.on('error', (err) => {
      fail(err);
    });

    proc.on('close', (code) => {
      if (settled) return; // might have already failed via timeout/abort/error

      if (code === 0) {
        settled = true;
        cleanup();
        resolve(stdout);
      } else {
        fail(
          new Error(
            `${label} exited with code ${code ?? 'null'}${
              stderr ? `: ${stderr}` : ''
            }`,
          ),
        );
      }
    });
  });
}