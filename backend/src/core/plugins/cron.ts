import fp from 'fastify-plugin';
import cron from 'node-cron';
import { FastifyPluginAsync } from 'fastify';
import { appLogger } from './logger';

const logger = appLogger('Cron');

const cronPlugin: FastifyPluginAsync = async (fastify) => {

  logger.info('[+] Cronjobs Initialized!');
};

export default fp(cronPlugin);