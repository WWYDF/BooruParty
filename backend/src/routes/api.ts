import { FastifyPluginAsync } from 'fastify';
import avatarUploadRoute from './avatars';
import statsRoute from './stats';
import postDeleteRoute from './delete/posts';
import avatarDeleteRoute from './delete/avatars';
import uploadRoute from './upload';
import { postReplaceRoute, thumbnailReplaceRoute } from './replacer';
import checkRoutes from './checks';

const apiRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(uploadRoute, { prefix: '/api' });
  fastify.register(avatarUploadRoute, { prefix: '/api' });
  fastify.register(statsRoute, { prefix: '/api' });
  fastify.register(postDeleteRoute, { prefix: '/api' });
  fastify.register(avatarDeleteRoute, { prefix: '/api' });
  fastify.register(postReplaceRoute, { prefix: '/api' });
  fastify.register(thumbnailReplaceRoute, { prefix: '/api' });
  fastify.register(checkRoutes, { prefix: '/api' })
};

export default apiRoutes;