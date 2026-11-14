import { prisma } from '@/core/plugins/prisma';
import { FastifyPluginAsync } from 'fastify';
import { clearSessionCookies } from '@/core/utilities/sessions';
import { appLogger } from '@/core/plugins/logger';

const logger = appLogger('Users/Private');

const privateUsers: FastifyPluginAsync = async (fastify) => {

  // Every route in this file requires being logged in
  fastify.addHook('onRequest', fastify.authenticate);

  // Base /me -> Returns user object from DB with stuff like email.
  fastify.get('/', async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { role: true },
      omit: { passHash: true },
    });

    // Account was deleted, but their access token hasn't expired yet
    if (!user) {
      clearSessionCookies(reply);
      return reply.status(401).send({ error: 'Unauthorized', hint: "You aren't logged in" });
    }

    return reply.status(200).send(user);
  });
};

export default privateUsers;