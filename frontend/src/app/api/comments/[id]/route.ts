import { auth } from "@/core/auth";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function DELETE( req: Request, context: { params: Promise<{ id: string }> }) {
  const prams = await context.params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commentId = parseInt(prams.id);
  if (isNaN(commentId)) {
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  const comment = await prisma.comments.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isOwner = comment.authorId === session.user.id;
  const canDeleteOthers = await checkPermissions("comment_delete_others");

  if (!isOwner && !canDeleteOthers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.comments.delete({
    where: { id: commentId },
  });

  return NextResponse.json({ success: true });
}
