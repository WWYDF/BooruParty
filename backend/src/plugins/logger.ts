import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';

const LOG_DIR = path.resolve(process.cwd(), "data", "logs");
let appLogStream: fs.WriteStream | null = null;


const routeLogger: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (req) => {
    (req as any).startTime = process.hrtime();
  });

  fastify.addHook('onResponse', async (req, res) => {
    const [s, ns] = process.hrtime((req as any).startTime);
    const duration = (s * 1e3 + ns / 1e6).toFixed(1);

    const method = req.raw.method ?? 'GET';
    const url = req.raw.url ?? '';
    const status = res.statusCode;

    // Skip logging for /data/* unless it's a 404
    if (url.startsWith('/data/') && status !== 404) return;

    // Ignore OPTIONS
    if (method == 'OPTIONS') return;

    const time = chalk.gray(`[${new Date().toLocaleTimeString()}]`);

    const statusColor =
      status >= 500 ? chalk.red
      : status >= 400 ? chalk.yellow
      : status >= 300 ? chalk.cyan
      : chalk.green;

    const methodColor = {
      GET: chalk.greenBright,
      POST: chalk.yellow,
      PUT: chalk.blueBright,
      PATCH: chalk.magentaBright,
      DELETE: chalk.redBright,
    }[method] || chalk.white;

    console.log(
      `${time} ${methodColor(method)} ${chalk.white(url)} ${statusColor(status)} ${chalk.gray(`(${duration}ms)`)}`
    );
  });
};

export default fp(routeLogger);


export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error';

export function appLogger(
  name: string,
  minLevel: LogLevel = ((process.env.LOG_LEVEL ?? 'debug').toLowerCase() as LogLevel)
) {
  const levels: LogLevel[] = ['verbose', 'debug', 'info', 'warn', 'error']
  const levelColor: Record<LogLevel, (txt: string) => string> = {
    verbose: chalk.magenta,
    debug: chalk.gray,
    info: chalk.cyan,
    warn: chalk.yellow,
    error: chalk.red,
  }

  const minIndex = levels.indexOf(minLevel)

  const paddedPrefix = `[${name}]`.padEnd(20)
  const formatLevel = (level: LogLevel) => {
    const raw = `[${level.toUpperCase()}]`.padEnd(10)
    return levelColor[level](raw)
  }

  const log = (level: LogLevel, message: any, ...args: any[]) => {
    if (levels.indexOf(level) < minIndex) return;

    const tag = formatLevel(level);
    const prefix = chalk.gray(paddedPrefix);

    // If debug, make message and args gray
    const isDebug = level === 'debug';
    const format = (x: any) =>
      typeof x === 'string' ? chalk.gray(x) : x;

    const msg = isDebug ? format(message) : message;
    const rest = isDebug ? args.map(format) : args;

    // file logging
    const ts = new Date().toISOString();
    const levelTag = `[${level.toUpperCase()}]`;
    const filePrefix = `[${ts}] [${name}] ${levelTag}`;

    const stringify = (v: any) => {
      if (typeof v === 'string') return v;
      try {
        return JSON.stringify(v);
      } catch {
        return String(v);
      }
    };

    const fileLine =
      filePrefix +
      ' ' +
      [message, ...args].map(stringify).join(' ');

    writeAppLogLine(fileLine);

    console.log(`${prefix} ${tag}`, msg, ...rest);
  };

  return {
    verbose: (msg: any, ...a: any[]) => log('verbose', msg, ...a),
    debug:   (msg: any, ...a: any[]) => log('debug',   msg, ...a),
    info:    (msg: any, ...a: any[]) => log('info',    msg, ...a),
    warn:    (msg: any, ...a: any[]) => log('warn',    msg, ...a),
    error:   (msg: any, ...a: any[]) => log('error',   msg, ...a),
  }
}

function writeAppLogLine(line: string) {
  try {
    if (!appLogStream) return; // initAppLogFile must be called at startup
    appLogStream.write(line + '\n');
  } catch (err) {
    console.error('[appLogger:file] Failed to write log line:', err);
  }
}


export function initAppLogFile() {
  fs.mkdirSync(LOG_DIR, { recursive: true }); // ensure dir exists

  // Create a new file for this run
  const ts = new Date().toISOString().replace(/[:.]/g, '-'); // safe for filenames
  const filename = `${ts}.log`;
  const filePath = path.join(LOG_DIR, filename);

  appLogStream = fs.createWriteStream(filePath, { flags: 'a' });
}

export function rotateAppLogs(maxFiles = 10) {
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });

    const entries = fs
      .readdirSync(LOG_DIR)
      .filter((f) => f.endsWith('.log'))
      .map((name) => {
        const full = path.join(LOG_DIR, name);
        const stat = fs.statSync(full);
        return { name, path: full, mtimeMs: stat.mtimeMs };
      })
      // Oldest first
      .sort((a, b) => a.mtimeMs - b.mtimeMs);

    if (entries.length > maxFiles) {
      const toDelete = entries.slice(0, entries.length - maxFiles);
      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path);
        } catch (err) {
          console.error('[appLogger:file] Failed to delete old log:', file.path, err);
        }
      }
    }
  } catch (err) {
    console.error('[appLogger:file] Rotation error:', err);
  }
}