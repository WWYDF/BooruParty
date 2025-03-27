import { FastifyPluginAsync } from 'fastify';
import staticPlugin from '@fastify/static';
import path from 'path';

const registerStatic: FastifyPluginAsync = async (fastify) => {
  fastify.register(staticPlugin, {
    root: path.join(__dirname, '../../uploads'),
    prefix: '/uploads/',
  });
};

export default registerStatic;
