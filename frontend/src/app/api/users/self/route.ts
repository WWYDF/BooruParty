import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { setAvatarUrl } from '@/core/reformatProfile';

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
          blurUnsafeEmbeds: true,
          defaultSafety: true,
          blacklistedTags: {
            include: {
              category: true
            }
          },
          profileBackground: true,
          private: true,
          favoriteTags: {
            include: {
              category: true
            }
          },
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
