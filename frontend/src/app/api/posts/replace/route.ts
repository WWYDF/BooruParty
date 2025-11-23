import { resolveFileType } from "@/core/dictionary";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/core/prisma';
import { checkFile } from "@/components/serverSide/UploadProcessing/checkHash";
import { auth } from "@/core/authServer";
import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { FastifyUpload } from "@/core/types/posts";

export async function POST(req: NextRequest) {
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
    where: { id: parseInt(postId) },
    select: {
      uploadedById: true,
      dupeBypass: true
    },
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

  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  const fileType = resolveFileType(`.${extension}`);
  let previewSrc;

  const buffer = Buffer.from(await file.arrayBuffer());
  // run pHash duplicate detection
  const hashResult = await checkFile(buffer, extension, fileType);

  // Reject duplicates by comparing result IDs
  if (hashResult.status === true && hashResult.ogPost!.id != parseInt(postId) && currentPost.dupeBypass == false) {
    return NextResponse.json({ error: `This image already exists in post #${hashResult.ogPost!.id}!`, duplicate: true, postId: hashResult.ogPost!.id }, { status: 409 });
  }

  // Forward to Fastify
  const proxyForm = new FormData();
  proxyForm.append("postId", postId);
  proxyForm.append("file", file, file.name);

  const fastifyResponse = await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/replace`, {
    method: "POST",
    body: proxyForm,
  });
  
  if (!fastifyResponse.ok) {
    return NextResponse.json({ error: "Fastify upload failed" }, { status: 500 });
  }
  
  const result = await fastifyResponse.json() as FastifyUpload;
  if (result.deletedPreview == true) { previewSrc = `/data/uploads/${fileType}/${postId}.${extension}`; }
  else { previewSrc = `/data/previews/${fileType}/${postId}.${result.assignedExt}` }
  
  await prisma.posts.update({
    where: { id: Number(postId) },
    data: {
      pHash: hashResult.genHash ?? null,
      previewScale: result.previewScale,
      previewPath: previewSrc,
      aspectRatio: result.aspectRatio,
      fileExt: result.finalExt,
      fileSize: result.fileSize,
      originalPath: result.originalPath
    },
  });

  // Log action, but log nothing if nothing changed.
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  await reportAudit(session.user.id, 'UPDATE', 'POST', ip, `Swapped content on Post #${postId}`);
  
  return NextResponse.json({ success: true });
}