import { prisma } from '@/core/plugins/prisma';
import { FastifyPluginAsync } from 'fastify';
import { clearSessionCookies, createSession } from '@/core/utilities/sessions';
import { appLogger } from '@/core/plugins/logger';
import { emailSchema, passwordSchema, usernameSchema } from '@/core/objects/fastifySchemas';
import { Prisma, Safety } from '../../../prisma/client';
import bcrypt from 'bcrypt';
import { rolePermissionCheck, rolePermissionList } from '@/core/utilities/permissionCache';

const logger = appLogger('Users/Private');

const privateUsers: FastifyPluginAsync = async (fastify) => {

  // Every route in this file requires being logged in
  fastify.addHook('onRequest', fastify.authenticate);

  // Base /me -> Returns user object from DB with stuff like email.
  fastify.get('/', async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      include: { role: true },
      omit: { passHash: true },
    });

    // Account was deleted, but their access token hasn't expired yet
    if (!user) {
      clearSessionCookies(reply);
      return reply.status(401).send({ error: 'Unauthorized', hint: "You aren't logged in" });
    }

    return reply.status(200).send({ ...user, permissions: rolePermissionList(user.roleId) });
  });

  // Base /me -> Edit base user object like user, pass, or email
  fastify.patch('/', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          username: usernameSchema,
          email: emailSchema,
          password: passwordSchema,       // the NEW password
          currentPassword: { type: 'string', maxLength: 1024 },
          private: { type: 'boolean' },
        },
      },
    },
  }, async (req, reply) => {
    const body = req.body as {
      username?: string,
      email?: string,
      password?: string,
      currentPassword?: string,
      private?: boolean,
    };

    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user) {
      clearSessionCookies(reply);
      return reply.status(401).send({ error: 'Unauthorized', hint: "You aren't logged in" });
    }

    // Sensitive changes need the current password
    if (body.email !== undefined || body.password !== undefined) {
      const valid = body.currentPassword && await bcrypt.compare(body.currentPassword, user.passHash);
      if (!valid) { return reply.status(403).send({ error: 'Forbidden', hint: "Current password is incorrect" }); };
    }

    // Build the update from only the fields that were sent
    const data: Prisma.UserUpdateInput = {};
    if (body.username !== undefined) data.username = body.username.trim();
    if (body.email !== undefined) data.email = body.email.trim().toLowerCase();
    if (body.private !== undefined) data.private = body.private;
    if (body.password !== undefined) {
      if (Buffer.byteLength(body.password) > 72) { return reply.status(400).send({ error: 'Password is too long' }); }
      data.passHash = await bcrypt.hash(body.password, 12);
    }

    try {
      const updated = await prisma.user.update({
        where: { id: user.id },
        data,
        include: { role: true },
        omit: { passHash: true },
      });

      // New password -> log out of every session, then grant this user a new one
      if (body.password !== undefined) {
        await prisma.session.deleteMany({ where: { userId: user.id } });
        await createSession(req, reply, { sub: updated.id, username: updated.username, roleId: updated.roleId });
      }

      return reply.status(200).send(updated);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const field = (e.meta?.target as string[])?.includes('email') ? 'Email' : 'Username';
        return reply.status(409).send({ error: `${field} is already taken` });
      }
      logger.error('Failed to update user', e);
      return reply.status(500).send({ error: 'Something went wrong' });
    }
  });

  // Edit Preferences
  fastify.patch('/preferences', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          blurUnsafeEmbeds: { type: 'boolean' },
          defaultSafety: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: Object.values(Safety) } },
          profileBackground: { type: ['integer', 'null'], minimum: 1 },
        },
      },
    },
  }, async (req, reply) => {
    const data = req.body as {
      blurUnsafeEmbeds?: boolean,
      defaultSafety?: Safety[],
      profileBackground?: number | null,
    };

    // Changing the background needs its own permission
    if (data.profileBackground !== undefined && !rolePermissionCheck(req.user.roleId, 'profile.edit.background')) {
      return reply.status(403).send({ error: 'Forbidden', hint: "Missing permission: profile.edit.background" });
    }

    const prefs = await prisma.preferences.upsert({
      where: { userId: req.user.sub },
      update: data,
      create: { userId: req.user.sub, ...data }
    });

    return reply.status(200).send(prefs);
  });
};

export default privateUsers;