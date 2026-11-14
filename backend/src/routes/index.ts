import { FastifyPluginAsync } from 'fastify';
import { appLogger } from '../core/plugins/logger';

const logger = appLogger('Routes');

const routes: FastifyPluginAsync = async (fastify) => {

  logger.info('[+] API Routes Initialized!');
};

export default routes;