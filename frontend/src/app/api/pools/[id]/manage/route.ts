import { prisma } from "@/core/prisma";
import { NextRequest, NextResponse } from "next/server";

// Add Posts to this Pool
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const prams = await context.params;
  const poolId = parseInt(prams.id);
  if (isNaN(poolId)) {
    return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
  }

  const body = await req.json();
  const postId = parseInt(body?.postId);

  if (!postId || isNaN(postId)) {
    return NextResponse.json({ error: "Missing or invalid postId" }, { status: 400 });
  }

  try {
    const existing = await prisma.poolItems.findUnique({
      where: { poolId_postId: { poolId, postId } }
    });

    if (existing) {
      return NextResponse.json({ error: "Post already in pool" }, { status: 409 });
    }

    const currentCount = await prisma.poolItems.count({ where: { poolId } });

    const newItem = await prisma.poolItems.create({
      data: {
        poolId,
        postId,
        index: currentCount
      }
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (err) {
    console.error("Failed to add post to pool", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
