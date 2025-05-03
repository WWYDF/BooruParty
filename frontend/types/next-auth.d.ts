import NextAuth from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      avatar: string;
      role: {
        name: string;
        permissions: { name: string }[];
      }
    };
  }

  interface User {
    id: string;
    email: string;
    username: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    username: string;
  }
}
