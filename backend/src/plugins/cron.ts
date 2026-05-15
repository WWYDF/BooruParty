import fp from 'fastify-plugin';
import cron from 'node-cron';
import { FastifyPluginAsync } from 'fastify';
import { updateSpaceUsed } from '../cronjobs/serverSize';

const cronPlugin: FastifyPluginAsync = async (fastify) => {
  
  // [ServerSize] Every 3 hours
  cron.schedule('0 */3 * * *', async () => {
    await updateSpaceUsed();
  });
};

export default fp(cronPlugin);