import { NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { prisma } from "@/core/prisma";
import { reportAudit } from '@/components/serverSide/auditLog';

export async function POST(req: Request) {
  const { email, username, password } = await req.json();

  if (!email || !username || !password) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (!process.env.REGISTRATION) {
    return NextResponse.json({ error: 'Registration is disabled' }, { status: 403 });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }],
    },
  });

  if (existingUser) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const hashedPassword = await hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      username,
      password: hashedPassword,
      roleId: 1
    },
  });

  await prisma.userPreferences.create({
    data: {
      id: user.id,
      layout: 'GRID',
      theme: 'DARK'
    }
  })

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  await reportAudit(user.id, 'CREATE', 'PROFILE', ip, `User Registered with email: ${email}`);

  return NextResponse.json({ user: { id: user.id, email: user.email, username: user.username } });
}
