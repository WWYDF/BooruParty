import { FastifyPluginAsync } from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'path';

const registerStatic: FastifyPluginAsync = async (fastify) => {
  fastify.register(staticPlugin, {
    root: path.resolve(process.cwd(), 'data/'),
    prefix: '/data/',
    setHeaders: (res, filePath) => {
      // Cache for 1 hour
      res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    },
  });
};

export default registerStatic;