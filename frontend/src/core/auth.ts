import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { JWT } from 'next-auth/jwt';
import { AuthOptions, Session, User } from 'next-auth';
import { prisma } from "@/core/prisma";
import { setAvatarUrl } from './reformatProfile';
import type { JWTArgs } from "next-auth";

export function auth() {
  return getServerSession(authOptions)
}

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
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, trigger, session }: JWTArgs) {
      if (user) {
        // Fetch full user info from DB on first login
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: {
            role: {
              select: {
                name: true,
                permissions: { select: { name: true } }
              }
            }
          }
        });
    
        if (dbUser) {
          token.id = dbUser.id;
          token.username = dbUser.username;
          token.avatar = setAvatarUrl(dbUser.avatar)
          token.role = dbUser.role?.name || 'GUEST';
          token.permissions = dbUser.role?.permissions.map(p => p.name) || [];
        }
      }

      if (trigger === 'update' && session) {
        if (session.user?.username) token.username = session.user.username;
        if (session.user?.avatar) token.avatar = session.user.avatar;
      }

      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (!token?.id) return null as unknown as Session;
    
      // Validate user still exists
      const user = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { id: true }
      });
    
      if (!user) {
        // Assert as known return type even though we know it will invalidate the session
        return null as unknown as Session;
      }
    
      session.user = {
        ...session.user, // Keep default values (like email)
        id: token.id as string,
        username: token.username as string,
        avatar: token.avatar as string,
        role: {
          name: token.role as string,
          permissions: (token.permissions as string[]).map(p => ({ name: p }))
        }
      };
    
      return session;
    },
  },
};