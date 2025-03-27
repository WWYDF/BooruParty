import { prisma } from "@/core/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const postId = parseInt(searchParams.get("postId") || "");

  if (isNaN(postId)) {
    return NextResponse.json({ error: "Missing or invalid postId" }, { status: 400 });
  }

  const comments = await prisma.comments.findMany({
    where: { postId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(comments);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { postId, author, message } = body;

  if (!postId || !author || !message?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const comment = await prisma.comments.create({
    data: {
      postId,
      authorId: author,
      content: message,
    },
  });

  return NextResponse.json(comment, { status: 201 });
}
