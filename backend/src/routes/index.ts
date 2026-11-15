import { FastifyPluginAsync } from 'fastify';
import { appLogger } from '../core/plugins/logger';
import authUsers from './Users/auth';
import privateUsers from './Users/private';
import publicUsers from './Users/public';
import createPost from './Posts/create';
import tagCategories from './Tags/categories';
import tags from './Tags/tags';
import viewPosts from './Posts/view';

const logger = appLogger('Routes');

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.register(authUsers, { prefix: '/auth' });
  fastify.register(privateUsers, { prefix: '/me' });
  fastify.register(publicUsers, { prefix: '/users' });
  fastify.register(createPost, { prefix: '/posts' });
  fastify.register(viewPosts, { prefix: '/posts' });
  fastify.register(tagCategories, { prefix: '/tag-categories' });
  fastify.register(tags, { prefix: '/tags' });

  logger.success('[+] API Routes Initialized!');
};

export default routes;