import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import * as dotenv from 'dotenv';
import ipFilter from './plugins/ipFilter';
import registerStatic from './plugins/static';
import cors from '@fastify/cors'
import fs from 'fs';
import path from 'path';
import routeLogger, { appLogger, initAppLogFile } from './plugins/logger';
import chalk from 'chalk';
import apiRoutes from './routes/api';

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
    });

  await fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5 MB
    },
  });

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Accept any origin and echo it back — as long as it's defined (browser request)
      if (origin) {
        cb(null, origin); // echo origin back = "fake *"
      } else {
        cb(null, true); // SSR, curl, etc.
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  initAppLogFile(); // rotate logs
  await fastify.register(routeLogger);
  logger.info('[+] Logger loaded successfully!');
  await fastify.register(ipFilter);
  logger.info('[+] Plugins loaded successfully!');

  for (const dir of DIRECTORIES) { fs.mkdirSync(dir, { recursive: true }); };
  logger.info('[+] Essential Directories loaded successfully!');

  await fastify.register(registerStatic);
  logger.info('[+] Asset Routes loaded successfully!');
  await fastify.register(apiRoutes); // handles its own prefix /api/
  logger.info('[+] REST API Routes loaded successfully!');

  return fastify;
}

async function start() {
  const filePath = path.join(process.cwd(), 'data');
  fs.mkdirSync(filePath, { recursive: true });
  const server = await buildServer();

  try {
    // Activate Server
    const PORT = Number(process.env.PORT || 3005);
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log('');
    console.log(chalk.greenBright(`[>] Server Startup Completed.`));
    console.log('');
  } catch (err) {
    logger.error(err);
    process.exit(1);
  }
}

start();
