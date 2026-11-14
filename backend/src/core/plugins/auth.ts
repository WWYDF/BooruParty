import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

// What we put inside every access token.
// It should be small since it's sent with every request, and it can go stale for up to TTL.
export type AccessTokenPayload = {
  sub: string;      // User.id (never the username, since usernames can change)
  username: string;
  roleId: number;
};

export const TTL = '15m';

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
    cookie: { cookieName: 'bpauth', signed: false },
    sign: { expiresIn: TTL },
  });

  // Use as a route hook: { onRequest: [fastify.authenticate] }
  // On success, req.user is populated with the token payload.
  fastify.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      // Missing, expired, or tampered token. The frontend treats 401 as "call /auth/refresh".
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });
};

// fp() breaks Fastify's plugin encapsulation so `authenticate` (and the cookie/jwt
// decorators) are visible to the routes registered after this plugin.
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
  }
}
