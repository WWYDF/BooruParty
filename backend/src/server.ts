import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import * as dotenv from 'dotenv';
import cors from '@fastify/cors'
import fs from 'fs';
import path from 'path';
import routeLogger, { appLogger } from './core/plugins/logger';
import chalk from 'chalk';
import { LEGIBLE_VERSION } from './core/version';
import cronPlugin from './core/plugins/cron';
import routes from './routes';

dotenv.config();
const logger = appLogger('Server');

const DIRECTORIES = [
  "data/uploads",
  "data/uploads/video",
  "data/uploads/image",
  "data/uploads/animated",
  "data/thumbnails",
  "data/previews/image",
  "data/previews/animated",
  "data/previews/video",
  "data/temp",
]


async function buildServer() {
  console.clear();
  const fastify = Fastify({
      logger: {
        level: 'warn', // Only logs 'warn', 'error', 'fatal'
        transport: {
          target: 'pino-pretty',
          options: {
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      },
      trustProxy: true
    });

  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
    },
  });

  await fastify.register(routeLogger);
  logger.info('[+] Logger loaded successfully!');

  // Comma-separated list of frontend origins allowed to make credentialed (cookie) requests.
  // e.g. ALLOWED_ORIGINS=http://localhost:3000,https://booru.example.com
  const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim().replace(/\/+$/, '')) // origins never have a trailing slash
    .filter(Boolean);

  if (allowedOrigins.length === 0) {
    logger.warn('[!] ALLOWED_ORIGINS is not set! Browsers will be blocked from using the API.');
  }

  await fastify.register(cors, {
    // Requests without an Origin header (curl, SSR) aren't subject to CORS and still work.
    // Unlisted origins get no CORS headers, so the browser won't let their JS read responses.
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  for (const dir of DIRECTORIES) { fs.mkdirSync(dir, { recursive: true }); };
  logger.info('[+] Essential Directories loaded successfully!');

  // logger.info('[+] Asset Routes loaded successfully!');
  await fastify.register(routes, { prefix: '/api' });
  
  await fastify.register(cronPlugin);
  logger.info('[+] Cronjobs loaded successfully!');

  // Autorun on Startup
  console.log(' ');

  return fastify;
}

async function start() {
  const filePath = path.join(process.cwd(), 'data');
  fs.mkdirSync(filePath, { recursive: true });
  const server = await buildServer();

  if (process.env.LOG_LEVEL && process.env.LOG_LEVEL.toUpperCase() == 'VERBOSE') {
    logger.verbose(`[!] Logging is set to verbose! It's not recommended to run a production instance like this!`)
  }

  try {
    // Activate Server
    const PORT = Number(process.env.PORT || 3005);
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log('');
    console.log(chalk.greenBright(`[>] Server Startup Completed. (${LEGIBLE_VERSION})`));
    console.log('');
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

start();
