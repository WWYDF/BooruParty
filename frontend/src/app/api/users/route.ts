import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { setAvatarUrl } from '@/core/reformatProfile';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      preferences: true
      // add whatever other sensitive data you want here
    },
  });

  return NextResponse.json({
    ...user,
    avatar: setAvatarUrl(user?.avatar)
  });
}

const updateUserSchema = z.object({
    username: z.string().min(3).max(32).optional(),
    email: z.string().email().optional(),
    password: z.string().min(6).optional(),
    layout: z.enum(['GRID', 'COLLAGE']).optional(),
    theme: z.enum(['DARK', 'LIGHT']).optional(),
    postsPerPage: z.number().default(30),
    avatar: z.string().url().optional(),
});
  
export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const json = await req.json();
    const parsed = updateUserSchema.safeParse(json);

    if (!parsed.success) {
        return NextResponse.json(
        { error: 'Invalid data', issues: parsed.error.flatten() },
        { status: 400 }
        );
    }

    const { username, email, password, layout, theme, postsPerPage } = parsed.data;
    const userId = session.user.id;

    const updates: any = {};
    if (username) updates.username = username;
    if (email) updates.email = email;
    if (password) updates.password = await bcrypt.hash(password, 10);

    const prefUpdates: any = {};
    if (layout) prefUpdates.layout = layout;
    if (theme) prefUpdates.theme = theme;
    if (postsPerPage) prefUpdates.postsPerPage = postsPerPage;

    try {
        await prisma.user.update({
          where: { id: userId },
          data: {
              ...updates,
              preferences: Object.keys(prefUpdates).length
              ? { update: prefUpdates }
              : undefined,
          },
        });

        return NextResponse.json({ success: true });
    } catch (err: any) {
        if (err.code === 'P2002') {
        return NextResponse.json(
            { error: 'Duplicate entry: username or email already exists' },
            { status: 409 }
        );
        }

        console.error('Update error:', err);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}