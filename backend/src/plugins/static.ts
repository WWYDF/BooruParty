import { FastifyPluginAsync } from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'path';

const registerStatic: FastifyPluginAsync = async (fastify) => {
  fastify.register(staticPlugin, {
    root: path.resolve(process.cwd(), 'data/'),
    prefix: '/data/',
    setHeaders: (res, filePath) => {
      // Cache for 3 hours
      res.setHeader('Cache-Control', 'public, max-age=10800, immutable');

      // Avatars cache for 6 hours
      if (filePath.includes('/avatars/')) {
        res.setHeader('Cache-Control', 'public, max-age=21600');
      }
    },
  });
};

export default registerStatic;