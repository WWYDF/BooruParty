// app/api/posts/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/auth";
import { reportAudit } from "@/components/serverSide/auditLog";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { postIds } = body;
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!Array.isArray(postIds) || postIds.some((id) => typeof id !== "number")) {
    return NextResponse.json({ error: "Invalid postIds array" }, { status: 400 });
  }

  // Get permissions and user
  const perms = await checkPermissions([
    "post_delete_own",
    "post_delete_others"
  ]);
  
  const canDeleteOwnPosts = perms["post_delete_own"];
  const canDeleteOthersPosts = perms["post_delete_others"];

  if (!canDeleteOwnPosts && !canDeleteOthersPosts) {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  // Fetch posts to determine ownership
  const posts = await prisma.posts.findMany({
    where: { id: { in: postIds } },
    select: { id: true, uploadedById: true }
  });

  const unauthorized = posts.some((post) => {
    const isOwner = post.uploadedById === session.user.id;
    return !(isOwner ? canDeleteOwnPosts : canDeleteOthersPosts);
  });

  if (unauthorized) {
    return NextResponse.json({ error: "Not authorized to delete one or more posts" }, { status: 403 });
  }

  try {
    // Delete from database
    await prisma.posts.deleteMany({
      where: { id: { in: postIds } }
    });

    // Delete files from Fastify
    await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/delete/posts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postIds }),
    });

    // Log actions in database
    await reportAudit(session.user.id, 'DELETE', 'POST', `Deleted Posts: ${postIds}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
