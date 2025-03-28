import { prisma } from "@/core/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const post = await prisma.posts.findUnique({
    where: { id: postId },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json(post);
}


export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const postId = parseInt(id);
  if (isNaN(postId)) {
    return NextResponse.json({ error: "Invalid post ID" }, { status: 400 });
  }

  const body = await req.json();

  try {
    const updated = await prisma.posts.update({
      where: { id: postId },
      data: {
        tags: body.tags,
        sources: body.sources,
        notes: body.notes,
        safety: body.safety,
        anonymous: body.anonymous,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update post:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}