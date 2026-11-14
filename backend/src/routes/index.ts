import { FastifyPluginAsync } from 'fastify';
import { appLogger } from '../core/plugins/logger';
import authUsers from './Users/auth';
import privateUsers from './Users/private';

const logger = appLogger('Routes');

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.register(authUsers, { prefix: '/auth' });
  fastify.register(privateUsers, { prefix: '/me' });

  logger.info('[+] API Routes Initialized!');
};

export default routes;