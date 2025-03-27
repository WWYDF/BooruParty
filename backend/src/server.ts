import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import dotenv from 'dotenv';
import ipFilter from './plugins/ipFilter';
import registerStatic from './plugins/static';
import uploadRoutes from './routes/upload';


dotenv.config();

async function buildServer() {
  const fastify = Fastify({ logger: true });

  await fastify.register(multipart);
  await fastify.register(ipFilter);
  await fastify.register(registerStatic);
  await fastify.register(uploadRoutes, { prefix: '/api' });

  return fastify;
}

async function start() {
  const server = await buildServer();
  try {
    await server.listen({ port: 3005, host: '0.0.0.0' });
    console.log('🚀 Server running on http://localhost:3005');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
