import { getServerSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { JWT } from 'next-auth/jwt';
import { AuthOptions, Session, User } from 'next-auth';
import { prisma } from "@/core/prisma";
import { updateLastSeen } from '@/components/serverSide/lastSeen';

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
      async jwt({ token, user }: { token: JWT; user?: User }) {
      if (user) {
        token.id = user.id;
        token.username = user.name ?? '';
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

      // Update Last Login
      await updateLastSeen(token.id);
    
      session.user.id = token.id as string;
      session.user.username = token.username as string;
    
      return session;
    },
  },
};