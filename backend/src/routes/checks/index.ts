import { FastifyPluginAsync } from 'fastify';
import integrityCheck from './integrity';
import previewSize from './previewSize';
import videoMeta from './videoMeta';

const checkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(integrityCheck, { prefix: '/checks' });
  fastify.register(previewSize, { prefix: '/checks' });
  fastify.register(videoMeta, { prefix: '/checks' });
};

export default checkRoutes;