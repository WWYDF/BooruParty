import { prisma } from '@/core/plugins/prisma';
import { FastifyPluginAsync } from 'fastify';
import { clearSessionCookies, createSession, hashToken } from '@/core/utilities/sessions';
import bcrypt from 'bcrypt';
import { appLogger } from '@/core/plugins/logger';
import { Prisma } from '../../../prisma/client';
import { emailSchema, passwordSchema, usernameSchema } from '@/core/objects/fastifySchemas';

const logger = appLogger('Auth');
const DUMMY_HASH = '$2b$12$ekdKhFYGe/WzS9ICFt7imOGAHL56bdhKH8jAVySfiU.20YrrUBgWa';

const authUsers: FastifyPluginAsync = async (fastify) => {
  // User Registration
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'email', 'password'],
        additionalProperties: false,
        properties: {
          username: usernameSchema,
          email: emailSchema,
          password: passwordSchema,
        },
      },
    },
    config: { rateLimit: { max: 3, timeWindow: '1 hour' } },
  }, async (req, reply) => {

    const body = req.body as {
      username: string,
      email: string,
      password: string,
    }

    const username = body.username.trim();
    const email = body.email.trim().toLowerCase();
    if (Buffer.byteLength(body.password) > 72) { return reply.status(400).send({ error: 'Password is too long' }); };

    const defaultRole = await prisma.role.findFirst({ where: { isDefault: true }}); // if somehow multiple roles are default, pick first.
    if (!defaultRole) { return reply.status(500).send({ error: "No default role configured" }) };

    const passHash = await bcrypt.hash(body.password, 12);

    // Check if a username with different casing exists first
    const exists = await prisma.user.findFirst({ where: { username: { equals: username, mode: 'insensitive' } } });
    if (exists) { return reply.status(409).send({ error: 'Username is already taken' }) };

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

  // User Login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        additionalProperties: false,
        properties: {
          email: { type: 'string', maxLength: 254 },
          password: { type: 'string', maxLength: 1024 },
        },
      },
    },
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (req, reply) => {

    const body = req.body as {
      email: string,
      password: string,
    }

    const email = body.email.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email }, include: { role: true } });
    const valid = await bcrypt.compare(body.password, user?.passHash ?? DUMMY_HASH);

    if (!user || !valid) {
      return reply.status(401).send({ error: 'Invalid username or password' });
    }

    // User info is valid
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    const { passHash, ...safeUser } = user;
    await createSession(req, reply, { sub: user.id, username: user.username, roleId: user.roleId });
    return reply.status(200).send(safeUser);
  });


  // Refresh Token
  fastify.post('/refresh', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } }}, async (req, reply) => {
    const token = req.cookies.bpRFT;
    if (!token) { return reply.status(401).send({ error: 'Unauthorized', hint: 'You must log in first' }) };

    // Hash token & get current session match
    const tokenHash = hashToken(token);
    const session = await prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { include: { role: true }, omit: { passHash: true } } },
    });

    // If no matching session OR session is expired
    if (!session || session.expiresAt < new Date()) {
      if (session) await prisma.session.deleteMany({ where: { id: session.id }});
      clearSessionCookies(reply);
      return reply.status(401).send({ error: 'Session expired', hint: 'You must log in again' });
    };
    
    // Rotate out old session (if none were deleted, do not grant a new session)
    const { count } = await prisma.session.deleteMany({ where: { id: session.id } });
    if (count === 0) {
      // Another request used this refresh token a moment ago
      clearSessionCookies(reply);
      return reply.status(401).send({ error: 'Session expired' });
    }

    // Send back new (refreshed) session
    const { user } = session;
    await createSession(req, reply, { sub: user.id, username: user.username, roleId: user.roleId });
    return reply.status(200).send(user);
  });


  // Logging out
  fastify.post('/logout', async (req, reply) => {
    const token = req.cookies.bpRFT;
    if (token) { await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } }) };

    clearSessionCookies(reply);
    return reply.status(204).send();
  });
};

export default authUsers;