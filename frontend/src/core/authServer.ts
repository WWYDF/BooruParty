import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { JWT } from 'next-auth/jwt';
import { AuthOptions, Session, User } from 'next-auth';
import { prisma } from "@/core/prisma";
import { updateLastSeen } from '@/components/serverSide/lastSeen';
import { cache } from 'react';

// How long a cached role/permissions snapshot is trusted before we re-check the DB.
// Bounds how long a role change, promotion, or ban takes to actually apply.
const refreshMs = 60 * 1000;

type AuthSnapshot = {
  username: string;
  roleId: number | null;
  roleIndex: number | null;
  permissions: string[];
};

// getServerSession() is called with no req/res from Server Components and Route
// Handlers ("RSC mode"), where next-auth stubs out cookie writing entirely.
// So anything the jwt() callback mutates on the token never makes it back into the browser's cookie.
// That rules out caching freshness inside the JWT itself: every request would just re-decode the original, never-updated cookie.
// Caching the DB lookup in server memory instead sidesteps that limitation.
const authSnapshotCache = new Map<string, { data: AuthSnapshot | null; expiresAt: number }>();

async function getAuthSnapshot(userId: string): Promise<AuthSnapshot | null> {
  const cached = authSnapshotCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  // console.debug(`Refreshing auth snapshot for ${userId}`);

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      username: true,
      roleId: true,
      role: { select: { index: true, permissions: { select: { name: true } } } },
    },
  });

  const data: AuthSnapshot | null = dbUser
    ? {
        username: dbUser.username,
        roleId: dbUser.roleId ?? null,
        roleIndex: dbUser.role?.index ?? null,
        permissions: dbUser.role?.permissions.map((p) => p.name) ?? [],
      }
    : null;

  authSnapshotCache.set(userId, { data, expiresAt: Date.now() + refreshMs });

  if (data) await updateLastSeen(userId).catch(() => {});

  return data;
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
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (!token?.id) return null as unknown as Session;

      const snapshot = await getAuthSnapshot(token.id);
      if (!snapshot) return null as unknown as Session; // user was deleted/banned

      session.user.id = token.id;
      session.user.username = snapshot.username;
      session.user.roleId = snapshot.roleId;
      session.user.roleIndex = snapshot.roleIndex;
      session.user.permissions = snapshot.permissions;

      return session;
    },
  },
};