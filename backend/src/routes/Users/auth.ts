import { prisma } from '@/core/plugins/prisma';
import { FastifyPluginAsync } from 'fastify';
import { createSession } from '@/core/utilities/sessions';
import bcrypt from 'bcrypt';
import { appLogger } from '@/core/plugins/logger';
import { Prisma } from '../../../prisma/client';

const logger = appLogger('Auth');

const authUsers: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', { schema: {
    body: {
      type: 'object',
      required: ['username', 'email', 'password'],
      additionalProperties: false,
      properties: {
        username: { type: 'string', minLength: 3, maxLength: 32, pattern: '^[a-zA-Z0-9_.-]+$' },
        email: { type: 'string', format: 'email', maxLength: 254 },
        password: { type: 'string', minLength: 8, maxLength: 72 },
      },
    },
  }}, async (req, reply) => {

    const body = req.body as {
      username: string,
      email: string,
      password: string,
    }

    const username = body.username.toLowerCase();
    const email = body.email.trim().toLowerCase();
    if (Buffer.byteLength(body.password) > 72) { return reply.status(400).send({ error: 'Password is too long' }); };

    const defaultRole = await prisma.role.findFirst({ where: { isDefault: true }}); // if somehow multiple roles are default, pick first.
    if (!defaultRole) { return reply.status(500).send({ error: "No default role configured" }) };

    const passHash = await bcrypt.hash(body.password, 12);
    
    try {
      const user = await prisma.user.create({
        data: {
          email,
          username,
          passHash,
          roleId: defaultRole.id,
        },
        include: { role: true },
        omit: { passHash: true } // don't return their passHash lol
      });

      await createSession(req, reply, { sub: user.id, username: user.username, roleId: defaultRole.id });
      return reply.status(201).send(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const field = (e.meta?.target as string[])?.includes('email') ? 'Email' : 'Username';
        return reply.status(409).send({ error: `${field} is already taken` });
      }
      logger.error('Something went wrong while creating a new user!', e);
      return reply.status(500).send({ error: `Something went fatally wrong, contact server administrator` });
    }
  });
};

export default authUsers;