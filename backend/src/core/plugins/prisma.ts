import fp from 'fastify-plugin';
import { Prisma, PrismaClient } from '../../../prisma/client';
import { FastifyPluginAsync } from 'fastify';

// one instance, created when this module is first imported
export const prisma = new PrismaClient();

// Lets helpers run either standalone or inside a prisma.$transaction(async (tx) => ...)
export type Db = typeof prisma | Prisma.TransactionClient;

const prismaPlugin: FastifyPluginAsync = async (fastify) => {
  await prisma.$connect();                                // fail fast at boot
  fastify.addHook('onClose', () => prisma.$disconnect());
};

export default fp(prismaPlugin);
