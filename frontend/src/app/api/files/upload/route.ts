import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/auth';
import { checkFile } from '@/components/serverSide/UploadProcessing/checkHash';

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  // Begin processing stuff
  const buffer = Buffer.from(await file.arrayBuffer());
  const checkMatch = await checkFile(buffer);
  if (checkMatch.status == true) {
    return Response.json({ duplicate: true, postId: checkMatch.postId }, { status: 409 });
  }

  const anonymous = formData.get('anonymous') === 'true';
  const safety = formData.get('safety') as 'SAFE' | 'SKETCHY' | 'UNSAFE';

  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  const createdPost = await prisma.posts.create({
    data: {
      fileExt: extension,
      uploadedById: session.user.id,
      anonymous,
      safety,
      sources: [],
      notes: '',
      flags: [],
      pHash: checkMatch.genHash || null,
    },
  });

  const postId = createdPost.id;

  const fastifyFormData = new FormData();
  fastifyFormData.append('postId', postId.toString());
  fastifyFormData.append('file', file);

  const fastifyResponse = await fetch(`${fastify}/api/upload`, {
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

  const fastifyResult = await fastifyResponse.json();

  await prisma.posts.update({
    where: { id: postId },
    data: {
      previewScale: fastifyResult.previewScale
    },
  })

  return NextResponse.json({ success: true, postId, fileName: fastifyResult.fileName });
}
