import 'dotenv/config';
import Fastify, { FastifyError } from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors'
import fs from 'fs';
import path from 'path';
import routeLogger, { appLogger } from './core/plugins/logger';
import chalk from 'chalk';
import { LEGIBLE_VERSION } from './core/version';
import rateLimit from '@fastify/rate-limit';
import cronPlugin from './core/plugins/cron';
import routes from './routes';
import auth from './core/plugins/auth';
import prismaPlugin from './core/plugins/prisma';
import { checkSetup } from './core/setup';
import { loadRolePermissions } from './core/utilities/permissionCache';
import sharp from 'sharp';
import { initializeEncoder } from './components/uploads/encoders';
import uploadsHost from './core/plugins/uploads';
import { STATUS_CODES } from 'http';
import { loadServerSettings } from './core/utilities/settingsCache';
import { HttpError } from './core/utilities/errors';
import { loadServerAddons } from './core/utilities/addonsCache';

sharp.cache(false);
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
  "data/avatars",
  "data/temp",
]


async function buildServer() {
  console.clear();
  console.log(' ');
  const PORT = Number(process.env.API_PORT || 3070);

  const trustedProxies = [
    'loopback',
    ...(process.env.TRUSTED_PROXIES ?? '')
      .split(',')
      .map((ip) => ip.trim())
      .filter(Boolean),
  ];


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
      trustProxy: trustedProxies,
    });

  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
    },
  });

  await fastify.register(routeLogger);
  logger.success('[+] Logger loaded successfully!');

  await fastify.register(rateLimit, { global: false });
  logger.success('[+] Rate Limiter loaded successfully!');

  const allowedOrigins = [process.env.FRONTEND_URL, `http://localhost:${PORT}`, 'http://localhost:3069']
    .filter((o): o is string => Boolean(o))
    .map((o) => o.trim().replace(/\/+$/, '')); // origins never have a trailing slash

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

  fastify.setErrorHandler<FastifyError>((err, req, reply) => {
    // Our own "send exactly this" errors, thrown from helpers or routes
    if (err instanceof HttpError) return reply.status(err.status).send(err.body);

    const status = err.statusCode ?? 500;

    if (status >= 500) {
      logger.error(err);
      return reply.status(500).send({ error: 'Internal Server Error', hint: 'Contact the server administrator' });
    }

    return reply.status(status).send({ error: STATUS_CODES[status] ?? 'Error', hint: err.message });
  });

  for (const dir of DIRECTORIES) { fs.mkdirSync(dir, { recursive: true }); };
  logger.success('[+] Essential Directories loaded successfully!');

  await fastify.register(prismaPlugin);
  logger.success('[+] Prisma loaded successfully!');
  await fastify.register(auth);
  logger.success('[+] Auth loaded successfully!');

  await fastify.register(routes, { prefix: '/api' });
  await fastify.register(uploadsHost);
  logger.success('[+] Uploads Host loaded successfully!');

  await fastify.register(cronPlugin);

  // Autorun on Startup
  await checkSetup(); // make sure server has been setup
  await loadRolePermissions(); // load role permissions into memory
  await loadServerSettings(); // load server settings into memory
  await loadServerAddons(); // load server addons into memory
  await initializeEncoder(); // Pick and validate an encoder for video previews
  
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
    const PORT = Number(process.env.API_PORT || 3070);
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
