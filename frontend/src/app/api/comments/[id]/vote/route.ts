import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/authServer";

// Vote on a specific comment
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commentId = parseInt(id);
  if (isNaN(commentId)) {
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  const { vote } = await req.json();
  if (![1, 0, -1].includes(vote)) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }

  try {
    if (vote === 0) {
      // Remove vote
      await prisma.commentVotes.deleteMany({
        where: { commentId, userId },
      });
    } else {
      // Upsert vote
      await prisma.commentVotes.upsert({
        where: {
          userId_commentId: {
            userId,
            commentId,
          },
        },
        update: { vote },
        create: {
          userId,
          commentId,
          vote,
        },
      });
    }

    // Return updated score
    const { _sum } = await prisma.commentVotes.aggregate({
      where: { commentId },
      _sum: { vote: true },
    });

    return NextResponse.json({ success: true, score: _sum.vote ?? 0 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}