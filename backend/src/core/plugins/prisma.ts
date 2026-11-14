import fp from 'fastify-plugin';
import { PrismaClient } from '../../../prisma/client';
import { FastifyPluginAsync } from 'fastify';

// one instance, created when this module is first imported
export const prisma = new PrismaClient();

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  await prisma.$connect();                                // fail fast at boot
  fastify.addHook('onClose', () => prisma.$disconnect());
};

export default fp(prismaPlugin);
