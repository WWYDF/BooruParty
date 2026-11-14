import { FastifyReply, FastifyRequest } from "fastify";
import { AccessTokenPayload } from "../plugins/auth";
import { prisma } from '../plugins/prisma'
import crypto from "crypto";

const isProduction = process.env.MODE === 'PRODUCTION';

export async function createSession(req: FastifyRequest, reply: FastifyReply, user: AccessTokenPayload) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.session.create({
    data: {
      userId: user.sub,
      tokenHash,
      expiresAt,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    }
  });
  const access = await reply.jwtSign(user);
  reply.setCookie('bpJWT', access, { httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/', maxAge: 15*60 });
  reply.setCookie('bpRFT', token, { httpOnly: true, sameSite: 'lax', secure: isProduction, path: '/api/auth', maxAge: 30*24*60*60 });
}