import { checkPermissions } from "@/components/serverSide/permCheck";
import { getConversionType } from "@/core/dictionary";
import { prisma } from "@/core/prisma";
import { setAvatarUrl } from "@/core/reformatProfile";
import { NextRequest, NextResponse } from "next/server";

// GET endpoint to retrieve a single post by ID
export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const permCheck = await checkPermissions('posts_view');
    if (!permCheck) { return NextResponse.json({ error: "You are unauthorized to view posts." }, { status: 401 }); }
  } catch {}

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
      _count: {
        select: {
          favoritedBy: true
        }
      }
    }
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Might not need this anymore
  const previewExt = getConversionType(post.fileExt);

  const postFormatted = {
    ...post,
    uploadedBy: post.uploadedBy
      ? {
          ...post.uploadedBy,
          avatar: setAvatarUrl(post.uploadedBy.avatar)
        }
      : null,
    previewExt,
    previewPath: `${process.env.NEXT_PUBLIC_FASTIFY}${post.previewPath}`,
  }

  return NextResponse.json({post: postFormatted});
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