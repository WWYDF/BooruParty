import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/auth";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function DELETE(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode"); // "delete" | "transfer"
  const targetUserId = url.searchParams.get("user") ?? session.user.id;
  const isSelfDelete = targetUserId === session.user.id;
  let ip = undefined; // We don't want to log the IPs of users trying to delete their account.

  // If attempting to delete someone else, check permission
  let canArchiveOthers = false;
  let canDeleteOthers = false;
  if (!isSelfDelete) {
    const perms = await checkPermissions([
      'profile_archive_others',
      'profile_delete_others'
    ]);
    
    canArchiveOthers = perms['profile_archive_others'];
    canDeleteOthers = perms['profile_delete_others'];

    const forwarded = req.headers.get("x-forwarded-for");
    ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  }
  
  try {
    // Remove User's Votes on Posts.
    // Step 1: Get all votes by this user
    const votes = await prisma.votes.findMany({
      where: { userId: targetUserId },
      select: {
        postId: true,
        type: true,
      },
    });

    // Step 2: Calculate vote impact per post
    const postScoreMap = new Map<number, number>();

    for (const vote of votes) {
      const delta = vote.type === "UPVOTE" ? -1 : 1; // Reverse effect of vote
      postScoreMap.set(vote.postId, (postScoreMap.get(vote.postId) ?? 0) + delta);
    }

    // Step 3: Update each post’s score
    await Promise.all(
      Array.from(postScoreMap.entries()).map(([postId, delta]) =>
        prisma.posts.update({
          where: { id: postId },
          data: {
            score: {
              increment: delta,
            },
          },
        })
      )
    );


    if (mode === "transfer") {
      if (!isSelfDelete && !canArchiveOthers) { return NextResponse.json({ error: "You lack the required permissions to archive other users' profiles." }, { status: 403 }); }

      // Retain posts: Reassign to system user with id "0" (deleted)
      await prisma.posts.updateMany({
        where: { uploadedById: targetUserId },
        data: { uploadedById: "0" },
      });

      // Report BEFORE deleting the user lol
      await reportAudit(session.user.id, 'ARCHIVE', 'PROFILE', ip, `Target ID: ${targetUserId}, isOwner: ${isSelfDelete}`);

      // Now run delete function (Settings, favorites, likes, etc.)
      await prisma.user.delete({
        where: { id: targetUserId },
      });

    } else { // User wants to delete everything
      if (!isSelfDelete && !canDeleteOthers) { return NextResponse.json({ error: "You lack the required permissions to delete other users' profiles." }, { status: 403 }); }

      // Gather postIds to ask Fastify to purge them
      const postsToDelete = await prisma.posts.findMany({
        where: { uploadedById: targetUserId },
        select: { id: true },
      });

      const postIds = postsToDelete.map((p) => p.id);

      // If there are posts, notify Fastify of them
      if (postIds.length > 0) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/delete/posts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ postIds }),
          });
        } catch (err) {
          console.error("Failed to notify Fastify to delete post files:", err);
        }
      }

      // Report BEFORE deleting the user lol
      await reportAudit(session.user.id, 'DELETE', 'PROFILE', ip, `Target ID: ${targetUserId}, isOwner: ${isSelfDelete}`);

      // Fully cascade delete (Posts, settings, favorites, likes, etc.)
      await prisma.user.delete({
        where: { id: targetUserId },
      });
    }

    // Regardless, ask Fastify to remove their avatar history
    try {
      await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/delete/avatar/${targetUserId}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Failed to delete avatar files from Fastify:", err);
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("User deletion failed:", err);
    return NextResponse.json({ error: "Failed to delete user" }, { status: 500 });
  }
}