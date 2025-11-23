import { FastifyPluginAsync } from 'fastify';
import integrityCheck from './integrity';
import previewSize from './previewSize';

const checkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(integrityCheck, { prefix: '/checks' });
  fastify.register(previewSize, { prefix: '/checks' });
};

export default checkRoutes;