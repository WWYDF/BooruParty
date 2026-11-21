import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './prisma';
import { hashToken } from '../utilities/sessions';
import { timingSafeEqual } from 'crypto';

// What we put inside every access token.
// It should be small since it's sent with every request, and it can go stale for up to TTL.
export type AccessTokenPayload = {
  sub: string;      // User.id (never the username, since usernames can change)
  username: string;
  roleId: string;
};

export const TTL = '15m';


// Parses "Authorization: Basic base64(clientId:secret)" and, if valid, makes the request act as the app's owner
async function verifyApplication(req: FastifyRequest, header: string): Promise<boolean> {
  if (!header.startsWith('Basic ')) return false;

  const decoded = Buffer.from(header.slice(6), 'base64').toString();
  const sep = decoded.indexOf(':');
  if (sep === -1) return false;

  const clientId = decoded.slice(0, sep);
  const secret = decoded.slice(sep + 1);

  const app = await prisma.application.findUnique({
    where: { clientId },
    include: { owner: { select: { id: true, username: true, roleId: true } } },
  });
  if (!app) return false;

  // Constant-time compare so response timing doesn't leak how much of the hash matched
  const given = Buffer.from(hashToken(secret));
  const stored = Buffer.from(app.secretHash);
  if (given.length !== stored.length || !timingSafeEqual(given, stored)) return false;

  // Same shape a cookie login produces, so every existing route just works with apps
  req.user = { sub: app.owner.id, username: app.owner.username, roleId: app.owner.roleId };
  req.application = app.clientId;
  return true;
}

// Route hook for user-only routes ({ onRequest: [blockApplications] })
// Must run after authenticate/identify, since those are what set req.application
export async function blockApplications(req: FastifyRequest, reply: FastifyReply) {
  if (req.application) {
    return reply.status(403).send({ error: 'Forbidden', hint: 'Applications cannot use this route' });
  }
}


const authPlugin: FastifyPluginAsync = async (fastify) => {
  const secret = process.env.JWT_SECRET;

  // Anyone with this secret can forge a token for any user/role, so refuse to start without a real one.
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET is missing or too short (min 32 chars). Generate one and add it to .env.');
  }

  // Parses incoming cookies onto req.cookies, and adds reply.setCookie / reply.clearCookie.
  await fastify.register(cookie);

  await fastify.register(jwt, {
    secret,
    // Make req.jwtVerify() read the token from this cookie instead of the Authorization header.
    // signed: false because the JWT already carries its own signature.
    cookie: { cookieName: 'bpJWT', signed: false },
    sign: { expiresIn: TTL },
  });

  fastify.decorateRequest('application', null);

  // Use as a route hook: { onRequest: [fastify.authenticate] }
  // On success, req.user is populated with the token payload.
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (header) {
      if (await verifyApplication(req, header)) return;
      return reply.status(401).send({ error: 'Unauthorized', hint: 'Invalid application credentials' });
    }

    try {
      await req.jwtVerify();
    } catch {
      // Missing, expired, or tampered token. The frontend treats 401 as "call /auth/refresh".
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  // Use on public routes: { onRequest: [fastify.identify] }
  // No token -> guest (req.user stays empty). Valid token -> req.user is set.
  // Token present but expired/invalid -> 401, so the frontend refreshes instead of silently browsing as a guest.
  fastify.decorate('identify', async (req: FastifyRequest, reply: FastifyReply) => {
    const header = req.headers.authorization;
    if (header) {
      if (await verifyApplication(req, header)) return;
      return reply.status(401).send({ error: 'Unauthorized', hint: 'Invalid application credentials' });
    }

    if (!req.cookies.bpJWT) return;

    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
};

// fp() breaks Fastify's plugin encapsulation so `authenticate` (and the cookie/jwt decorators)
// are visible to the routes registered after this plugin.
export default fp(authPlugin);

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload; // type accepted by reply.jwtSign()
    user: AccessTokenPayload;    // type of req.user after jwtVerify()
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
    identify: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
  interface FastifyRequest {
    application: string | null; // clientId when an app made this request, null for normal users
  }
}
