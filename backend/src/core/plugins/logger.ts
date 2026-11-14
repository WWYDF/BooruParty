import fp from 'fastify-plugin';
import { FastifyPluginAsync } from 'fastify';
import chalk from 'chalk';

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

    // Skip logging for /assets/* unless it's a 404
    if (url.startsWith('/assets/') && status !== 404) return;

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

    if (method == 'OPTIONS') { return };
    console.log(
      `${time} ${methodColor(method)} ${chalk.white(url)} ${statusColor(status)} ${chalk.gray(`(${duration}ms) [${req.ip}]`)}`
    );
  });
};

export default fp(routeLogger);


export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error';


export function appLogger(
  name: string,
  minLevel: LogLevel = (process.env.LOG_LEVEL?.toLowerCase() as LogLevel) || 'debug'
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
    const raw = `[${level.toUpperCase()}]`.padEnd(8)
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