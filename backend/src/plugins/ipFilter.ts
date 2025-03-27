import { FastifyPluginAsync } from 'fastify';

const ipFilter: FastifyPluginAsync = async (fastify) => {
  const allowed = (process.env.ALLOWED_IPS || '').split(',').map(ip => ip.trim());

  fastify.addHook('onRequest', async (req, reply) => {
    if (!allowed.includes(req.ip)) {
      req.log.warn(`Blocked IP: ${req.ip}`);
      reply.code(403).send({ error: 'Forbidden' });
    }
  });
};

export default ipFilter;
