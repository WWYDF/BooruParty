import fp from 'fastify-plugin';
import cron from 'node-cron';
import { FastifyPluginAsync } from 'fastify';
import { appLogger } from './logger';
import { deleteExpiredSessions } from '../utilities/sessions';
import { updateServerStats } from '@/components/cronjobs/serverSide';

const logger = appLogger('Cron');

const cronPlugin: FastifyPluginAsync = async (fastify) => {

  // [Delete Old Sessions] Every day at 3:00am
  cron.schedule('0 3 * * *', async () => {
    const count = await deleteExpiredSessions();
    logger.info(`Deleted ${count} expired sessions.`)
  });

  // [Re-Calculate Data Size] Every 3 hours
  cron.schedule('0 */3 * * *', async () => {
    await updateServerStats();
  });

  // Additionally, run the following once at each startup:
  await updateServerStats();

  logger.success('[+] Cronjobs loaded successfully!');
};

export default fp(cronPlugin);