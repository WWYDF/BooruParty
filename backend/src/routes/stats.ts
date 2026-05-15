import { FastifyPluginAsync } from 'fastify';
import { appLogger } from '../plugins/logger';
import { LapisData, readLapisDb } from '../utils/lapisDb';

const logger = appLogger('Stats');

const statsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/stats', async (req, reply) => {

    const lapisDb = await readLapisDb<LapisData>();
    return reply.send({ totalMB: lapisDb.megaBytesUsed }); // Send total in megabytes
  });
};


export default statsRoute;