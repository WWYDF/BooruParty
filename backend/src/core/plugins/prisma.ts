import fp from 'fastify-plugin';
import { PrismaClient } from '../../../prisma/client';
import { FastifyPluginAsync } from 'fastify';

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  const prisma = new PrismaClient();
  await prisma.$connect();

  fastify.decorate('prisma', prisma);

  fastify.addHook('onClose', async (app) => {
    await app.prisma.$disconnect();
  });
};

// Export with `fp()` wrapper for proper plugin handling
export default fp(prismaPlugin);

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

declare global {
  // Prevent multiple instances in development
  var prisma: PrismaClient | undefined;
}

export const prisma = global.prisma ?? new PrismaClient(); // no logging