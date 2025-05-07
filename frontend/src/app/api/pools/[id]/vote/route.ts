import { prisma } from "@/core/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/core/authServer";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const prams = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const poolId = parseInt(prams.id);
  if (isNaN(poolId)) {
    return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
  }

  const { vote } = await req.json(); // expects 1 or -1

  if (![1, -1].includes(vote)) {
    return NextResponse.json({ error: "Vote must be 1 or -1" }, { status: 400 });
  }

  try {
    const userId = session.user.id;
    const existing = await prisma.poolVotes.findUnique({
      where: { poolId_userId: { poolId, userId } },
    });

    let finalVote: 1 | -1 | 0;

    if (existing) {
      if (existing.vote === vote) {
        // Same vote → remove
        await prisma.poolVotes.delete({
          where: { poolId_userId: { poolId, userId } },
        });
        finalVote = 0;
      } else {
        // Change vote
        await prisma.poolVotes.update({
          where: { poolId_userId: { poolId, userId } },
          data: { vote },
        });
        finalVote = vote;
      }
    } else {
      // New vote
      await prisma.poolVotes.create({
        data: { poolId, userId, vote },
      });
      finalVote = vote;
    }

    // Recalculate pool score
    const scoreResult = await prisma.poolVotes.aggregate({
      where: { poolId },
      _sum: { vote: true },
    });

    const score = scoreResult._sum.vote ?? 0;

    await prisma.pools.update({
      where: { id: poolId },
      data: { score },
    });

    return NextResponse.json({ success: true, score, vote: finalVote });
  } catch (err) {
    console.error("Pool voting failed:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}