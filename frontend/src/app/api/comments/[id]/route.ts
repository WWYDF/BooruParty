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
  const canDeleteOthers = (await checkPermissions(['comment_delete_others']))['comment_delete_others'];

  if (!isOwner && !canDeleteOthers) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.comments.delete({
    where: { id: commentId },
  });

  return NextResponse.json({ success: true });
}

export async function PATCH( req: Request, context: { params: Promise<{ id: string }> }) {
  const prams = await context.params;
  
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const commentId = parseInt(prams.id);
  if (isNaN(commentId)) {
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  const { content } = await req.json();
  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Empty content" }, { status: 400 });
  }

  const comment = await prisma.comments.findUnique({
    where: { id: commentId },
    select: { authorId: true },
  });

  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const isOwner = comment.authorId === session.user.id;
  const perms = await checkPermissions([
    'comment_edit_own',
    'comment_edit_others'
  ]);

  const canEditOwn = perms['comment_edit_own'];
  const canEditOthers = perms['comment_edit_others'];

  const allowed =
    (isOwner && canEditOwn) || (!isOwner && canEditOthers);

  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.comments.update({
    where: { id: commentId },
    data: { content },
  });

  return NextResponse.json({ success: true });
}
