import fp from 'fastify-plugin';
import cron from 'node-cron';
import { FastifyPluginAsync } from 'fastify';
import { appLogger } from './logger';
import { deleteExpiredSessions } from '../utilities/sessions';

const logger = appLogger('Cron');

const cronPlugin: FastifyPluginAsync = async (fastify) => {

  cron.schedule('0 3 * * *', async () => {
    const count = await deleteExpiredSessions();
    logger.info(`Deleted ${count} expired sessions.`)
  });

  logger.success('[+] Cronjobs loaded successfully!');
};

export default fp(cronPlugin);