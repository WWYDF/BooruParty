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
  
