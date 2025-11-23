import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { appLogger } from './logger';
const logger = appLogger('Firewall');

const ipFilterPlugin: FastifyPluginAsync = async (fastify) => {
  const raw = process.env.ALLOWED_IPS ?? '';

  // If ALLOWED_IPS is blank → localhost-only mode
  let allowed: string[];
  if (!raw.trim()) {
    allowed = ['127.0.0.1', '::1', '::ffff:127.0.0.1', '192.168.0.1', '192.168.1.1'];
    logger.warn(`[-] Environment Variable ALLOWED_IPS is not set. Running in local-network-only mode.`);
  } else {
    allowed = raw
      .split(',')
      .map(ip => ip.trim())
      .filter(Boolean);

    logger.info(`[+] Using ALLOWED_IPS. Allowed IPs: ${allowed.join(', ')}`);
  }

  fastify.decorate(
    'verifyIp',
    async function (request: any, reply: any) {
      const url = request.raw.url || request.url || '';

      const clientIp = request.ip; // respects trustProxy if enabled

      if (!allowed.includes(clientIp)) {
        logger.warn(`Blocked Unknown IP (${clientIp}) from accessing ${url}.`);
        return reply.code(403).send({ error: 'Forbidden' });
      }
    }
  );
};

export default fp(ipFilterPlugin);

declare module 'fastify' {
  interface FastifyInstance {
    verifyIp: (request: any, reply: any) => Promise<void>;
  }
}
