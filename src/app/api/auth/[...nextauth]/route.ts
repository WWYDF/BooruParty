import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import type { JWT } from 'next-auth/jwt';
import type { AuthOptions, Session, User } from 'next-auth';

const prisma = new PrismaClient();

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
            username: user.username,
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
        async jwt({ token, user }: { token: JWT; user?: User }) {
        if (user) {
          token.id = user.id;
          token.username = user.name ?? '';
        }
        return token;
      },
      async session({ session, token }: { session: Session; token: JWT }) {
        if (token) {
          session.user.id = token.id as string;
          session.user.username = token.username as string;
        }
        return session;
      },
    },
  };
  
  const handler = NextAuth(authOptions);
  export { handler as GET, handler as POST };