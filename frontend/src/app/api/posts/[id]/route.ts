import { prisma } from "@/core/prisma";
import { setAvatarUrl } from "@/core/reformatProfile";
import { NextRequest, NextResponse } from "next/server";

// GET endpoint to retrieve a single post by ID
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const post = await prisma.posts.findUnique({
    where: { id: postId },
    include: {
      tags: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
          aliases: {
            select: {
              id: true,
              alias: true
            }
          }
        }
      },
      uploadedBy: {
        select: {
          id: true,
          username: true,
          role: true,
          avatar: true
        }
      },
      favoritedBy: {
        select: {
          userId: true
        }
      }
    }
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const postWOFavorites = {
    ...post,
    favorites: post.favoritedBy.length,
    uploadedBy: post.uploadedBy
      ? {
          ...post.uploadedBy,
          avatar: setAvatarUrl(post.uploadedBy.avatar)
        }
      : null,
    favoritedBy: undefined
  }

  return NextResponse.json({post: postWOFavorites});
}

// PATCH endpoint to update a post by ID
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const postId = parseInt(id);

  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { tags, sources, notes, safety, anonymous } = body;

    if (!Array.isArray(tags) || !tags.every((t) => typeof t === "number")) {
      return NextResponse.json({ error: "Invalid tags format" }, { status: 400 });
    }

    const updatedPost = await prisma.posts.update({
      where: { id: postId },
      data: {
        tags: {
          set: tags.map((tagId) => ({ id: tagId })),
        },
        sources,
        notes,
        safety,
        anonymous,
      },
      include: {
        tags: {
          include: { category: true },
        },
      },
    });

    return NextResponse.json(updatedPost);
  } catch (error) {
    console.error("PATCH /api/posts/[id] error:", error);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}