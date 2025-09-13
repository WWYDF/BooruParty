import { resolveFileType } from "@/core/dictionary";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/core/prisma';
import { auth } from "@/core/authServer";
import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const postId = formData.get("postId");

  if (!file || !postId || typeof postId !== "string") {
    return NextResponse.json({ error: "Invalid upload" }, { status: 400 });
  }

  const perms = await checkPermissions([
    'post_edit_own',
    'post_edit_others'
  ]);

  const canEditOwn = perms['post_edit_own'];
  const canEditOthers = perms['post_edit_others'];

  if (!session || !canEditOwn && !canEditOthers) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const currentPost = await prisma.posts.findUnique({
    where: { id: parseInt(postId) }
  });

  if (!currentPost) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  // Permissions Check (Self)
  if (!canEditOthers) {
    if (currentPost.uploadedById !== session.user.id) {
      return NextResponse.json({ error: "You are unauthorized to edit your own posts." }, { status: 403 });
    }
  }

  const uploadedExtension = file.name.split(".").pop()?.toLowerCase() || "";
  const uploadedFileType = resolveFileType(`.${uploadedExtension}`);
  const originalFileType = resolveFileType(`.${currentPost.fileExt}`);
  if (originalFileType !== 'video') { return NextResponse.json({ error: "You can only edit the thumbnails of videos" }, { status: 400 }); };
  if (uploadedFileType !== 'image') { return NextResponse.json({ error: "You can only replace thumbnails with images" }, { status: 400 }); };


  // Forward to Fastify
  const proxyForm = new FormData();
  proxyForm.append("file", file, file.name);
  proxyForm.append("postId", postId);

  const fastifyResponse = await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/replace/thumbnail`, {
    method: "POST",
    body: proxyForm,
  });
  
  if (!fastifyResponse.ok) {
    return NextResponse.json({ error: "Fastify upload failed" }, { status: 502 });
  }
  
  // const result = await fastifyResponse.json();
  // we don't need to do anything on our end :)

  // Log action, but log nothing if nothing changed.
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  await reportAudit(session.user.id, 'UPDATE', 'POST', ip, `Updated thumbnails on Post #${postId}`);
  
  return NextResponse.json({ success: true });
}