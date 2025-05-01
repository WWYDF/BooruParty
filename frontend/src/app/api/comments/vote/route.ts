import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/auth";

export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId, vote } = await req.json();

  if (!commentId || ![-1, 0, 1].includes(vote)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  console.log(`Received value: ${vote}`);

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

    return NextResponse.json({
      success: true,
      score: _sum.vote ?? 0,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
