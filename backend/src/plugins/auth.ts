import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { appLogger } from './logger';

const logger = appLogger('Firewall');

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const sharedSecret = process.env.INTERNAL_SHARED_SECRET?.trim();

  if (!sharedSecret) {
    logger.error('INTERNAL_SHARED_SECRET is not set. All internal API calls will be denied, and the site will not work properly.');
  } else {
    logger.info('[+] INTERNAL_SHARED_SECRET loaded.');
  }

  fastify.decorate(
    'verifySecret',
    async function (request: any, reply: any) {
      const url = request.raw.url || request.url || '';

      // Bypass public / static routes
      if (
        url.startsWith('/uploads/') ||
        request.method === 'OPTIONS'
      ) { return; };

      const clientSecret = request.headers['x-internal-secret'];

      if (!sharedSecret || clientSecret !== sharedSecret) {
        logger.warn(`Blocked unauthorized internal request [-] ${url} (Secret Mismatch)`);
        return reply.code(401).send({ error: 'Unauthorized' });
      }
    }
  );
};

export default fp(authPlugin);

declare module 'fastify' {
  interface FastifyInstance {
    verifySecret: (request: any, reply: any) => Promise<void>;
  }
}
