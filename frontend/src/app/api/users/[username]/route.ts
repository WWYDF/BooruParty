import { prisma } from "@/core/prisma";
import { setAvatarUrl } from "@/core/reformatProfile";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ username: string }> }
) {
  const { username } = await context.params;

  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
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
      posts: {
        take: 25,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileExt: true,
          score: true,
          createdAt: true
        }
      },
      favorites: {
        select: {
          id: true,
          postId: true,
        }
      },
      comments: {
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          postId: true,
          content: true,
          createdAt: true
        }
      },
      role: {
        include: {
          permissions: {
            select: {
              name: true
            }
          }
        }
      }
      // add more fields if needed
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...user,
    avatar: setAvatarUrl(user?.avatar)
  });
}
