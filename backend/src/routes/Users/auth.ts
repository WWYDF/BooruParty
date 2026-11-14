import { FastifyPluginAsync } from 'fastify';

const authUsers: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', async (req, reply) => {
    
    return reply.status(200).send();
  });
};

export default authUsers;