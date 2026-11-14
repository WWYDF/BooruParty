import { FastifyPluginAsync } from 'fastify';
import { appLogger } from '@/core/plugins/logger';

const logger = appLogger('Users/Public');

const publicUsers: FastifyPluginAsync = async (fastify) => {


};

export default publicUsers;