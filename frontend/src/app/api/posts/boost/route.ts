import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/authServer";

function formatCooldown(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

// Creates a boost if the user hasn't boosted this post yet & its off cooldown.
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

  const setting = await prisma.siteSettings.findFirst();
  const cooldownMs = (setting?.boostCooldown ?? 86400) * 1000;
  const elapsed = latest ? Date.now() - latest.createdAt.getTime() : 0;
  const onCooldown = !!latest && elapsed < cooldownMs;

  if (onCooldown) {
    // Incoming PostID is the same as their current boost, remove it.
    if (latest.postId === postId) {
      await prisma.boosts.delete({ where: { id: latest.id } });
      return NextResponse.json({
        boosted: false,
        onCooldown: false,
        lastBoostAt: latest.createdAt,
      }, { status: 200 });
    }

    return NextResponse.json({
      boosted: false,
      onCooldown: true,
      reason: "already_boosted_today",
      remaining: formatCooldown(cooldownMs - elapsed),
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
    onCooldown: true,
    lastBoostAt: created.createdAt,
  }, { status: 201 });
}

// Returns whether the user has boosted this post recently.
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

  const setting = await prisma.siteSettings.findFirst();
  const cooldownMs = (setting?.boostCooldown ?? 86400) * 1000;
  const onCooldown = !!latest && (Date.now() - latest.createdAt.getTime()) < cooldownMs;

  return NextResponse.json({
    onCooldown,
    lastBoostAt: latest?.createdAt ?? null,
  });
}
