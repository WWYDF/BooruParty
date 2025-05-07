import { auth } from "@/core/authServer";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";
import { syncPostRelations } from "@/components/serverSide/Posts/syncRelations";
import { syncPostPools } from "@/components/serverSide/Posts/syncPools";
import { buildPostChangeDetails, reportAudit } from "@/components/serverSide/auditLog";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const perms = await checkPermissions(["post_edit_own", "post_edit_others"]);
  const canEditOwnPost = perms["post_edit_own"];
  const canEditOtherPosts = perms["post_edit_others"];

  if (!session || (!canEditOwnPost && !canEditOtherPosts)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;

  try {
    const body = await req.json();
    const { postIds, tags, safety, relatedPosts, pools, delete: shouldDelete } = body;

    if (!Array.isArray(postIds) || postIds.some((id) => typeof id !== "number")) {
      return NextResponse.json({ error: "Invalid postIds" }, { status: 400 });
    }

    const results = [];

    for (const postId of postIds) {
      const post = await prisma.posts.findUnique({
        where: { id: postId },
        select: {
          uploadedById: true,
          tags: true,
          sources: true,
          notes: true,
          safety: true,
          anonymous: true,
        }
      });

      if (!post) continue;

      const isOwnPost = post.uploadedById === session.user.id;
      if (!isOwnPost && !canEditOtherPosts) continue;

      if (shouldDelete) {
        await prisma.posts.delete({ where: { id: postId } });
        results.push({ id: postId, deleted: true });
        continue;
      }

      const updatedPost = await prisma.posts.update({
        where: { id: postId },
        data: {
          ...(tags ? { tags: { set: tags.map((id: number) => ({ id })) } } : {}),
          ...(safety ? { safety } : {}),
        },
        include: {
          tags: { include: { category: true } },
        },
      });

      if (relatedPosts !== undefined) {
        await syncPostRelations(postId, relatedPosts);
      }

      if (pools !== undefined) {
        await syncPostPools(postId, pools);
      }

      const changeDetails = buildPostChangeDetails(post, updatedPost);
      if (changeDetails.includes("Changes:")) {
        await reportAudit(session.user.id, "EDIT", "POST", ip, changeDetails);
      }

      results.push({ id: postId, updated: true });
    }

    return NextResponse.json({ success: true, results });
  } catch (err) {
    console.error("Mass edit error:", err);
    return NextResponse.json({ error: "Mass edit failed" }, { status: 500 });
  }
}
