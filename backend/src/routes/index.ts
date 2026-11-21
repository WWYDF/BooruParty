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
import viewPools from './Pools/view';
import managePools from './Pools/manage';
import poolPosts from './Pools/posts';
import poolInteractions from './Pools/interactions';
import applications from './Users/apps';
import manageCollections from './Collections/manage';
import postCollections from './Collections/posts';
import viewCollections from './Collections/view';
import roles from './System/roles';
import tagLists from './Users/tags';
import userActivity from './Users/activity';

const logger = appLogger('Routes');

const routes: FastifyPluginAsync = async (fastify) => {
  // Users / Auth
  fastify.register(authUsers, { prefix: '/auth' });
  fastify.register(privateUsers, { prefix: '/me' });
  fastify.register(publicUsers, { prefix: '/users' });
  fastify.register(avatars, { prefix: '/avatars' });
  fastify.register(applications, { prefix: '/applications' });
  fastify.register(tagLists, { prefix: '/me/tags' });
  fastify.register(userActivity, { prefix: '/users' });

  // Posts
  fastify.register(createPost, { prefix: '/posts' });
  fastify.register(viewPosts, { prefix: '/posts' });
  fastify.register(managePosts, { prefix: '/posts' });
  fastify.register(replacePosts, { prefix: '/posts' });
  fastify.register(featurePosts, { prefix: '/posts' });
  fastify.register(postInteractions, { prefix: '/posts' });
  fastify.register(postComments, { prefix: '/posts' });
  fastify.register(manageComments, { prefix: '/comments' });
  fastify.register(autoTagPosts, { prefix: '/posts' });

  // Tags
  fastify.register(tagCategories, { prefix: '/tag-categories' });
  fastify.register(tags, { prefix: '/tags' });

  // Pools
  fastify.register(viewPools, { prefix: '/pools' });
  fastify.register(managePools, { prefix: '/pools' });
  fastify.register(poolPosts, { prefix: '/pools' });
  fastify.register(poolInteractions, { prefix: '/pools' });

  // Collections
  fastify.register(manageCollections, { prefix: '/collections' }); // Create & Manage Collections
  fastify.register(postCollections, { prefix: '/collections' }); // Add Posts to Collections
  fastify.register(viewCollections, { prefix: '/collections' }); // View Collections (duh)

  // System
  fastify.register(stats, { prefix: '/system' });
  fastify.register(settings, { prefix: '/system' });
  fastify.register(addons, { prefix: '/system' });
  fastify.register(roles, { prefix: '/roles' });

  logger.success('[+] API Routes Initialized!');
};

export default routes;