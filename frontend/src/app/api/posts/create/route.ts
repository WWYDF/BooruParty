import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkFile } from '@/components/serverSide/UploadProcessing/checkHash';
import { getConversionType, resolveFileType } from '@/core/dictionary';
import { fetch, Agent, FormData } from 'undici';
import { FastifyUpload } from '@/core/types/posts';

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const { searchParams } = new URL(request.url);
  const skipDupeParam = searchParams.get("skipDupes") === "true";
  let skipDupes = false;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (skipDupeParam) {
    const authHeader = request.headers.get('X-Override'); // Allow internal server pages to access regardless.
    if (authHeader && authHeader == process.env.INTERNAL_API_SECRET) { skipDupes = true }
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const fileType = resolveFileType(`.${extension}`);

  if (fileType === 'other') {
    return NextResponse.json(
      { error: `File type .${extension} is not supported.` },
      { status: 415 } // 415 Unsupported Media Type
    );
  }

  // Begin processing stuff
  const buffer = Buffer.from(await file.arrayBuffer());
  const checkMatch = await checkFile(buffer, extension, fileType);
  if (checkMatch.status == true && skipDupes == false) {
    return Response.json({ duplicate: true, postId: checkMatch.postId }, { status: 409 });
  }

  const anonymous = formData.get('anonymous') === 'true';
  const safety = formData.get('safety') as 'SAFE' | 'SKETCHY' | 'UNSAFE';
  const rawTags = formData.get('tags') as string | null;
  const rawSource = formData.get("source") as string | null;
  const sources: string[] = rawSource ? JSON.parse(rawSource) : [];
  const notes = formData.get("notes") as string | null;

  const createdPost = await prisma.posts.create({
    data: {
      fileExt: extension,
      uploadedById: session.user.id,
      anonymous,
      safety,
      sources,
      notes,
      flags: [],
      pHash: checkMatch.genHash || null,
      fileSize: buffer.length,
    },
  });

  const postId = createdPost.id;

  const fastifyFormData = new FormData();
  fastifyFormData.append('postId', postId.toString());
  fastifyFormData.append('file', file);

  const fastifyResponse = await fetch(`${fastify}/api/upload`, {
    dispatcher: new Agent({ connectTimeout: 900 }),
    method: 'POST',
    body: fastifyFormData,
  });

  if (!fastifyResponse.ok) {
    // If Fastify upload fails, clean up by removing the post from Prisma
    await prisma.posts.delete({ where: { id: postId } });

    return NextResponse.json(
      { error: 'File upload to Fastify failed.' },
      { status: 500 }
    );
  }

  const fastifyResult = await fastifyResponse.json() as FastifyUpload;
  
  const conversionType = getConversionType(extension);
  let previewSrc;
  if (fastifyResult.deletedPreview == true) { previewSrc = `/data/uploads/${fileType}/${postId}.${conversionType}`; }
  else { previewSrc = `/data/previews/${fileType}/${postId}.${fastifyResult.assignedExt}` }

  // Mass Tagger on Upload
  if (rawTags) {
    let tagNames: string[];
    try {
      tagNames = JSON.parse(rawTags);
      if (!Array.isArray(tagNames)) throw new Error();
    } catch {
      return NextResponse.json({ error: "Invalid tag list format." }, { status: 400 });
    }
  
    // Force lowercase on all tag names
    tagNames = tagNames.map((n) => n.toLowerCase());
  
    const tags = await prisma.tags.findMany({
      where: {
        name: {
          in: tagNames,
        },
      },
    });
  
    if (tags.length !== tagNames.length) {
      const foundNames = tags.map((t) => t.name);
      const missing = tagNames.filter((n) => !foundNames.includes(n));
      return NextResponse.json(
        { error: `Invalid tag(s): ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Update post with received stuff from Fastify / Tags
    await prisma.posts.update({
      where: { id: postId },
      data: {
        previewScale: fastifyResult.previewScale,
        previewPath: previewSrc,
        aspectRatio: fastifyResult.aspectRatio,
        tags: {
          connect: tags.map((t) => ({ id: t.id })),
        },
      },
    })
  }

  return NextResponse.json({ success: true, postId, fileName: fastifyResult.fileName });
}
