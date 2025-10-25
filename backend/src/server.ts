import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import * as dotenv from 'dotenv';
import ipFilter from './plugins/ipFilter';
import registerStatic from './plugins/static';
import uploadRoutes from './routes/upload';
import avatarUploadRoute from './routes/avatars';
import statsRoute from './routes/stats';
import postDeleteRoute from './routes/delete/posts';
import avatarDeleteRoute from './routes/delete/avatars';
import postReplaceRoute from './routes/replace';
import cors from '@fastify/cors'
import fs from 'fs';
import path from 'path';

dotenv.config();

async function buildServer() {
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


  await fastify.register(ipFilter);
  await fastify.register(registerStatic);
  await fastify.register(uploadRoutes, { prefix: '/api' });
  await fastify.register(avatarUploadRoute, { prefix: '/api' });
  await fastify.register(statsRoute, { prefix: '/api' });
  await fastify.register(postDeleteRoute, { prefix: '/api' });
  await fastify.register(avatarDeleteRoute, { prefix: '/api' });
  await fastify.register(postReplaceRoute, { prefix: '/api' });

  return fastify;
}

async function start() {
  const filePath = path.join(process.cwd(), 'data');
  fs.mkdirSync(filePath, { recursive: true });

  const server = await buildServer();
  const port = Number(process.env.PORT ?? 3005);
  try {
    console.clear();
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server running on http://localhost:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
