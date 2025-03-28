import { prisma } from "@/core/prisma";
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
      postTags: {
        include: {
          tag: {
            include: {
              parentTag: {
                include: { category: true },
              },
            },
          },
        },
      },
    },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}

// PATCH endpoint to update a post by ID
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  const body = await req.json();

  if (!Array.isArray(body.tags)) {
    return NextResponse.json({ error: "Invalid tags format" }, { status: 400 });
  }

  try {
    // Look up the tag name records using the list of tag names (strings)
    const tagNameRecords = await prisma.tagName.findMany({
      where: {
        name: { in: body.tags },
      },
    });

    // Clear existing tag relations for this post
    await prisma.postTag.deleteMany({ where: { postId } });

    // Create new tag relations
    await prisma.postTag.createMany({
      data: tagNameRecords.map((tag) => ({
        postId,
        tagId: tag.id,
      })),
    });

    // Update other post fields (not tags)
    const updated = await prisma.posts.update({
      where: { id: postId },
      data: {
        sources: body.sources,
        notes: body.notes,
        safety: body.safety,
      },
      include: {
        postTags: {
          include: {
            tag: {
              include: {
                parentTag: {
                  include: { category: true },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update post:", err);
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}