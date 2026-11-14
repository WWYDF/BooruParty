import { FastifyPluginAsync } from 'fastify';
import { appLogger } from '@/core/plugins/logger';
import { prisma } from '@/core/plugins/prisma';
import { publicUserSelect } from '@/core/objects/userSelects';

const logger = appLogger('Users/Public');

const publicUsers: FastifyPluginAsync = async (fastify) => {

  // View a specific user's basic profile info
  fastify.get('/:username', {
    schema: {
      params: {
        type: 'object',
        required: ['username'],
        properties: { username: { type: 'string', maxLength: 32 } },
      },
    },
  }, async (req, reply) => {
    const { username } = req.params as { username: string };

    const user = await prisma.user.findUnique({
      where: { username },
      select: publicUserSelect
    });

    if (!user) { return reply.status(404).send({ error: 'Not Found', hint: "No user with that username" }) };

    return reply.status(200).send(user);
  });
};

export default publicUsers;