import { prisma } from '@/core/plugins/prisma';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { hashToken } from '@/core/utilities/sessions';
import { appLogger } from '@/core/plugins/logger';
import { randomBytes } from 'node:crypto';
import { blockApplications } from '@/core/plugins/auth';
import { requirePermission, rolePermissionCheck } from '@/core/utilities/permissionCache';
import { MAX_APPLICATIONS } from '@/core/objects/limits';
import { Prisma } from '../../../prisma/client';
import { avatarUrl } from '@/core/utilities/reformatters';

const logger = appLogger('Applications');

// Shared querystring schema for routes that can target another user
const ownerQuery = {
  type: 'object',
  additionalProperties: false,
  properties: { userId: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;

const clientIdParams = {
  type: 'object',
  required: ['clientId'],
  properties: { clientId: { type: 'string', minLength: 1, maxLength: 64 } },
} as const;


// Whose applications this request is about. Sends a 403 and returns null if not allowed.
function resolveOwner(req: FastifyRequest, reply: FastifyReply): string | null {
  const { userId } = req.query as { userId?: string };

  // No userId (or your own) -> yourself
  if (!userId || userId === req.user.sub) return req.user.sub;

  if (!rolePermissionCheck(req.user.roleId, 'applications.manage.others')) {
    reply.status(403).send({ error: 'Forbidden', hint: 'Missing permission: applications.manage.others' });
    return null;
  }
  return userId;
}

const applications: FastifyPluginAsync = async (fastify) => {

  // Every route in this file requires being logged in (NO APPLICATIONS)
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', blockApplications);
  fastify.addHook('onRequest', requirePermission('applications.manage.own'));

  // List own applications
  fastify.get('/', { schema: { querystring: ownerQuery } }, async (req, reply) => {
    const ownerId = resolveOwner(req, reply);
    if (!ownerId) return reply;

    const apps = await prisma.application.findMany({
      where: { ownerId },
      omit: { secretHash: true, ownerId: true },
      orderBy: { createdAt: 'asc' },
    });

    return reply.status(200).send(apps);
  });

  // Create own applications
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string', minLength: 1, maxLength: 32 } },
        additionalProperties: false,
      },
    },
  }, async (req, reply) => {

    const amt = await prisma.application.count({ where: { ownerId: req.user.sub } });
    if (amt >= MAX_APPLICATIONS) { return reply.status(409).send({ error: 'Too many applications', hint: `You can have a max of ${MAX_APPLICATIONS} applications` }) };

    const name = (req.body as { name: string }).name.trim();
    if (!name) { return reply.status(400).send({ error: 'Bad request', hint: 'Name is required' }) };

    const secret = randomBytes(32).toString('base64url');

    const app = await prisma.application.create({
      data: {
        name,
        secretHash: hashToken(secret),
        ownerId: req.user.sub,
      },
    });

    // The only time the plaintext secret ever leaves the server
    return reply.status(201).send({ clientId: app.clientId, name: app.name, createdAt: app.createdAt, secret });
  });

  // Delete an application
  fastify.delete('/:clientId', {
    schema: {
      params: clientIdParams,
      querystring: ownerQuery,
    },
  }, async (req, reply) => {
    const ownerId = resolveOwner(req, reply);
    if (!ownerId) return reply;

    const { clientId } = req.params as { clientId: string };

    // Ownership is part of the WHERE, so you can never delete an app that isn't the target user's
    const { count } = await prisma.application.deleteMany({ where: { clientId, ownerId } });
    if (count === 0) { return reply.status(404).send({ error: 'Not found', hint: 'Application not found' }) };

    if (ownerId !== req.user.sub) {
      logger.info(`${req.user.sub} deleted application ${clientId} owned by ${ownerId}`);
    }

    return reply.status(204).send();
  });

  // Regenerate own application's secret.
  // Self only: it returns a usable secret, so mods can't do this for others.
  fastify.post('/:clientId/secret', { schema: { params: clientIdParams } }, async (req, reply) => {
    const { clientId } = req.params as { clientId: string };
    const secret = randomBytes(32).toString('base64url');

    const { count } = await prisma.application.updateMany({
      where: { clientId, ownerId: req.user.sub },
      data: { secretHash: hashToken(secret) },
    });
    if (count === 0) { return reply.status(404).send({ error: 'Not found', hint: 'Application not found' }) };

    return reply.status(200).send({ clientId, secret });
  });

  // Admin only: List all applications (on dashboard)
  fastify.get('/all', {
    onRequest: [requirePermission('applications.manage.others')],
    schema: {
      querystring: {
        type: 'object',
        additionalProperties: false,
        properties: {
          q: { type: 'string', maxLength: 64 },        // app name contains
          owner: { type: 'string', maxLength: 32 },    // exact username
          page: { type: 'integer', minimum: 1, default: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
        },
      },
    },
  }, async (req, reply) => {
    const { q, owner, page, limit } = req.query as { q?: string, owner?: string, page: number, limit: number };

    const where: Prisma.ApplicationWhereInput = {
      ...(q && { name: { contains: q, mode: 'insensitive' } }),
      ...(owner && { owner: { username: owner } }),
    };

    const [apps, total] = await prisma.$transaction([
      prisma.application.findMany({
        where,
        select: {
          clientId: true,
          name: true,
          lastUsedAt: true,
          createdAt: true,
          owner: { select: { id: true, username: true, avatarKey: true, role: { select: { name: true, color: true } } } },
        },
        orderBy: [{ lastUsedAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }, { clientId: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.application.count({ where }),
    ]);

    return reply.send({
      applications: apps.map(({ owner, ...app }) => ({
        ...app,
        owner: { ...owner, avatar: avatarUrl(owner.avatarKey), avatarKey: undefined },
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    });
  });
};

export default applications;