import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/auth';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session || !session.user?.username) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  const createdPost = await prisma.posts.create({
    data: {
      fileExt: extension,
      uploadedBy: session.user.id,
      anonymous: false,
      safety: 'SAFE',
      tags: [],
      sources: [],
      notes: '',
      flags: [],
    },
  });

  const postId = createdPost.id;

  const fastifyFormData = new FormData();
  fastifyFormData.append('postId', postId.toString());
  fastifyFormData.append('file', file);

  const fastifyResponse = await fetch('http://localhost:3005/api/upload', {
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
