import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const url = new URL(req.url);
  const poolIdInt = parseInt(id);
  const current = Number(url.searchParams.get("current"));

  console.log("Pool ID:", poolIdInt, "Current Post ID:", current);

  if (isNaN(poolIdInt) || isNaN(current)) {
    return NextResponse.json({ error: "Invalid poolId or current ID" }, { status: 400 });
  }

  try {
    // Fetch all postIds in this pool in order
    const items = await prisma.poolItems.findMany({
      where: { poolId: poolIdInt },
      orderBy: { index: "asc" },
      select: { postId: true }
    });

    const postIds = items.map(item => item.postId);
    const idx = postIds.indexOf(current);

    if (idx === -1) {
      return NextResponse.json({ error: "Post not in pool" }, { status: 404 });
    }

    const previousPostId = postIds[idx - 1] ?? 0;
    const nextPostId = postIds[idx + 1] ?? 0;

    return NextResponse.json({ previousPostId, nextPostId });
  } catch (err) {
    console.error("Pool navigate failed:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
