import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/authServer";

// Creates a boost if the user hasn't boosted this post "today" (day/month/year) yet.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await req.json();
  if (!postId || typeof postId !== "number") {
    return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
  }

  // Get latest boost for this user/post
  const latest = await prisma.boosts.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, postId: true },
  });

  const today = new Date().toDateString();
  const boostedToday = !!latest && latest.createdAt.toDateString() === today;

  // User has boosted today
  if (boostedToday) {
    // Incoming PostID is the same as their boost today, remove it.
    if (latest.postId === postId) {
      await prisma.boosts.delete({ where: { id: latest.id } });
      return NextResponse.json({
        boosted: false,
        boostedToday: false,
        lastBoostAt: latest.createdAt,
      }, { status: 200 });
    }

    return NextResponse.json({
      boosted: false,
      boostedToday: true,
      reason: "already_boosted_today",
      lastBoostAt: latest.createdAt,
      lastBoostPost: latest.postId,
    }, { status: 409 });
  }

  const created = await prisma.boosts.create({
    data: {
      userId: session.user.id,
      postId,
    },
    select: { id: true, createdAt: true },
  });

  return NextResponse.json({
    boosted: true,
    boostedToday: true,
    lastBoostAt: created.createdAt,
  }, { status: 201 });
}

// Returns whether the user has boosted this post today.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const postId = parseInt(req.nextUrl.searchParams.get("postId") || "", 10);
  if (!postId) {
    return NextResponse.json({ error: "Invalid postId" }, { status: 400 });
  }

  const latest = await prisma.boosts.findFirst({
    where: { userId: session.user.id, postId },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true },
  });

  const today = new Date().toDateString();
  const boostedToday = !!latest && latest.createdAt.toDateString() === today;

  return NextResponse.json({
    boostedToday,
    lastBoostAt: latest?.createdAt ?? null,
  });
}
