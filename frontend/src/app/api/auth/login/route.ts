import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from "@/core/prisma";
import { encode } from 'next-auth/jwt';

// This file was unused in the frontend so I'm repurposing it for automation.
// Returns a JWT used for spoofing a cookie in REST Requests.

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (email == "deleted@system.local") { return NextResponse.json({ error: 'This account cannot be logged into.' }, { status: 401 }); }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await compare(password, user.password))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // Create session token manually
  const token = await encode({
    token: {
      id: user.id.toString(),
      username: user.username, // or whatever field holds the username
      name: user.username,
      email: user.email,
      sub: user.id.toString(),
    },
    secret: process.env.NEXTAUTH_SECRET!,
    maxAge: 24 * 60 * 60, // 24 hours
    // maxAge: 365 * 24 * 60 * 60, // 365 days
  });

  return NextResponse.json({ jwt: token });
}
