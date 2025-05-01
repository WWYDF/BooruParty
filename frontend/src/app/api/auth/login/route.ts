import { NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from "@/core/prisma";

export async function POST(req: Request) {
  const { email, password } = await req.json();

  if (email == "deleted@system.local") { return NextResponse.json({ error: 'This account cannot be logged into.' }, { status: 401 }); }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user || !(await compare(password, user.password))) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }

  // TODO: Add auth/session handling here

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
    },
  });
}
