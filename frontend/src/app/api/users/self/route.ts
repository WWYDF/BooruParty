import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { setAvatarUrl } from '@/core/reformatProfile';
import { reportAudit } from '@/components/serverSide/auditLog';

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    if (process.env.GUEST_VIEWING == "true") {
      const empty = {
        role: {
          id: -1,
          name: "GUEST",
          permissions: [
            {
              id: 24,
              name: "posts_view"
            }
          ]
        }
      }

      return NextResponse.json(empty);
    }
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatar: true,
      description: true,
      lastLogin: true,
      createdAt: true,
      preferences: {
        select: {
          layout: true,
          theme: true,
          postsPerPage: true,
        }
      },
      role: {
        include: {
          permissions: true
        }
      },
    }
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
  description: z.string().max(64).optional(),
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

  const { username, email, description, password, layout, theme, postsPerPage } = parsed.data;
  const userId = session.user.id;

  const updates: any = {};
  if (username) updates.username = username;
  if (email) updates.email = email;
  updates.description = description;
  if (password) updates.password = await bcrypt.hash(password, 10);

  const prefUpdates: any = {};
  if (layout) prefUpdates.layout = layout;
  if (theme) prefUpdates.theme = theme;
  if (postsPerPage) prefUpdates.postsPerPage = postsPerPage;

  try {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true }
    })

    const update = await prisma.user.update({
      where: { id: userId },
      data: {
        ...updates,
        preferences: Object.keys(prefUpdates).length
          ? {
              upsert: {
                update: prefUpdates,
                create: prefUpdates
              }
            }
          : undefined,
      },
    });

    // Log Username Changes
    if (current?.username != update.username) {
      const forwarded = req.headers.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
      await reportAudit(session.user.id, 'UPDATE', 'PROFILE', ip, `Username Change: (${current?.username}) -> (${update.username})`);
    }

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