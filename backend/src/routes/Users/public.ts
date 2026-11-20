import { FastifyPluginAsync } from 'fastify';
import { prisma } from '@/core/plugins/prisma';
import { userProfileSelect } from '@/core/objects/selects/users';
import { Prisma } from '../../../prisma/client';
import { userSummarySelect } from '@/core/objects/selects/summaries';
import { formatUserSummary } from '@/core/utilities/reformatters';

const publicUsers: FastifyPluginAsync = async (fastify) => {

  // View a specific user's basic profile info
  fastify.get('/:username', {
    schema: {
      params: {
        type: 'object',
        required: ['username'],
        properties: { username: { type: 'string', maxLength: 32 } },
      },
    },
  }, async (req, reply) => {
    const { username } = req.params as { username: string };

    const user = await prisma.user.findFirst({
      where: { username, id: { not: '0' } },
      select: userProfileSelect
    });

    if (!user) { return reply.status(404).send({ error: 'Not Found', hint: "No user with that username" }) };

    return reply.status(200).send(formatUserSummary(user));
  });

  // View a page of users
  fastify.get('/', {
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
          search: { type: 'string', maxLength: 32 },
          sort: { type: 'string', enum: ['newest', 'oldest', 'username'], default: 'newest' },
        },
      },
    },
  }, async (req, reply) => {
    const { page, limit, search, sort } = req.query as {
      page: number,
      limit: number,
      search?: string,
      sort: 'newest' | 'oldest' | 'username',
    };

    const where: Prisma.UserWhereInput = {
      id: { not: '0' }, // hide system user
      ...(search && { username: { contains: search } }),
    };
    const orderBy: Prisma.UserOrderByWithRelationInput[] = 
      sort === 'username' ? [{ username: 'asc' }]
      : sort === 'oldest' ? [{ updatedAt: 'asc' }, { id: 'asc' }]
      : [{ updatedAt: 'desc' }, { id: 'desc' }]
    
    const [users, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy,
        select: userSummarySelect,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    return reply.status(200).send({
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      users: users.map(formatUserSummary),
    })
  });
};

export default publicUsers;