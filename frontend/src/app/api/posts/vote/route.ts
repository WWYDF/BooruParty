import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/authServer";

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { postId, type } = body; // type: "UPVOTE" | "DOWNVOTE" | null

    if (!postId || (type !== "UPVOTE" && type !== "DOWNVOTE" && type !== null)) {
        return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
    }

    if (type === null) {
        // remove vote
        await prisma.votes.deleteMany({
            where: {
                postId,
                userId: session.user.id,
            },
        });
    } else {
        await prisma.votes.upsert({
            where: {
            postId_userId: {
                postId,
                userId: session.user.id,
            },
            },
            update: {
                type,
            },
            create: {
                postId,
                userId: session.user.id,
                type,
            },
        });
    }

    const existing = await prisma.posts.findUnique({
        where: {
            id: postId
        },
        select: {
            score: true
        }
    });

    const voteCounts = await prisma.votes.groupBy({
        by: ['type'],
        where: { postId },
        _count: { type: true },
    });

    const upvoteData = voteCounts.find(vote => vote.type === 'UPVOTE');
    const downvoteData = voteCounts.find(vote => vote.type === 'DOWNVOTE');

    const upvotes = upvoteData ? upvoteData._count.type : 0;
    const downvotes = downvoteData ? downvoteData._count.type : 0;

    await prisma.posts.update({
        where: {
            id: postId
        },
        data: {
            score: (upvotes - downvotes)
        }
    })

    return NextResponse.json({ success: true });
}

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ type: null }); // not logged in
    }
  
    const { searchParams } = new URL(req.url);
    const postId = parseInt(searchParams.get("postId") || "", 10);
    if (isNaN(postId)) {
      return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
    }
  
    const vote = await prisma.votes.findUnique({
      where: {
        postId_userId: {
          postId,
          userId: session.user.id,
        },
      },
      select: { type: true },
    });
  
    return NextResponse.json({ type: vote?.type ?? null });
}
  