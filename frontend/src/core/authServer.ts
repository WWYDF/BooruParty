import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { JWT } from 'next-auth/jwt';
import { AuthOptions, Session, User } from 'next-auth';
import { prisma } from "@/core/prisma";
import { updateLastSeen } from '@/components/serverSide/lastSeen';
import { cache } from 'react';

// How long a JWT can carry stale role/permissions before we re-check the DB.
// Bounds how long a role change, promotion, or ban takes to actually apply.
const refreshMs = 60 * 1000;

async function loadAuthSnapshot(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      roleId: true,
      role: { select: { index: true, permissions: { select: { name: true } } } },
    },
  });
}

// cache() dedupes repeated auth() calls within a single request (e.g. several
// checkPermissions() calls on one page render) down to one getServerSession() call.
export const auth = cache(() => getServerSession(authOptions));

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        const isValid = await compare(credentials.password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.username,
          username: user.username
        };
      },
    }),
    // EmailProvider({
    //   server: {
    //     host: process.env.SMTP_HOST,
    //     port: Number(process.env.SMTP_PORT),
    //     auth: {
    //       user: process.env.SMTP_USER,
    //       pass: process.env.SMTP_PASSWORD,
    //     },
    //   },
    //   from: process.env.SMTP_FROM,
    // }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        token.username = user.name ?? '';
        token.permsFetchedAt = undefined; // force an immediate DB load below
      }

      const isStale = !token.permsFetchedAt || Date.now() - token.permsFetchedAt > refreshMs;
      if (!token.id || !isStale) return token;

      const dbUser = await loadAuthSnapshot(token.id);
      if (!dbUser) {
        // User was deleted/banned since the last refresh; session callback will drop it.
        token.invalid = true;
        return token;
      }

      token.invalid = false;
      token.username = dbUser.username;
      token.roleId = dbUser.roleId ?? null;
      token.roleIndex = dbUser.role?.index ?? null;
      token.permissions = dbUser.role?.permissions.map((p) => p.name) ?? [];
      token.permsFetchedAt = Date.now();

      await updateLastSeen(dbUser.id).catch(() => {});

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (!token?.id || token.invalid) return null as unknown as Session;

      session.user.id = token.id;
      session.user.username = token.username;
      session.user.roleId = token.roleId ?? null;
      session.user.roleIndex = token.roleIndex ?? null;
      session.user.permissions = token.permissions ?? [];

      return session;
    },
  },
};