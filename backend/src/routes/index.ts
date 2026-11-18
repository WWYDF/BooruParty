import { FastifyPluginAsync } from 'fastify';
import { appLogger } from '../core/plugins/logger';
import authUsers from './Users/auth';
import privateUsers from './Users/private';
import publicUsers from './Users/public';
import createPost from './Posts/create';
import tagCategories from './Tags/categories';
import tags from './Tags/tags';
import viewPosts from './Posts/view';
import stats from './System/stats';
import managePosts from './Posts/manage';
import replacePosts from './Posts/replace';
import settings from './System/settings';
import featurePosts from './Posts/feature';
import postComments from './Posts/comments';
import manageComments from './Comments/manage';
import avatars from './Users/avatars';
import postInteractions from './Posts/interactions';
import autoTagPosts from './Posts/autotag';
import addons from './System/addons';

const logger = appLogger('Routes');

const routes: FastifyPluginAsync = async (fastify) => {
  fastify.register(authUsers, { prefix: '/auth' });
  fastify.register(privateUsers, { prefix: '/me' });
  fastify.register(publicUsers, { prefix: '/users' });
  fastify.register(avatars, { prefix: '/avatars' });
  fastify.register(createPost, { prefix: '/posts' });
  fastify.register(viewPosts, { prefix: '/posts' });
  fastify.register(managePosts, { prefix: '/posts' });
  fastify.register(replacePosts, { prefix: '/posts' });
  fastify.register(featurePosts, { prefix: '/posts' });
  fastify.register(postInteractions, { prefix: '/posts' });
  fastify.register(postComments, { prefix: '/posts' });
  fastify.register(manageComments, { prefix: '/comments' });
  fastify.register(autoTagPosts, { prefix: '/posts' });
  fastify.register(tagCategories, { prefix: '/tag-categories' });
  fastify.register(tags, { prefix: '/tags' });
  fastify.register(stats, { prefix: '/system' });
  fastify.register(settings, { prefix: '/system' });
  fastify.register(addons, { prefix: '/system' });

  logger.success('[+] API Routes Initialized!');
};

export default routes;