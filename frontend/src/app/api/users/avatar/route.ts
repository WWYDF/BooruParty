import { auth } from '@/core/auth';
import { fileTypeFromBuffer } from 'file-type';
import { prisma } from '@/core/prisma';

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType || !fileType.mime.startsWith('image/')) {
    return new Response(JSON.stringify({ error: 'Unsupported or invalid image type' }), { status: 400 });
  }

  const formData = new FormData();
  const blob = new Blob([buffer], { type: fileType.mime });
  const file = new File([blob], `avatar.${fileType.ext}`, { type: fileType.mime });

  formData.append('userId', userId);
  formData.append('avatar', file);

  const fastifyUrl = process.env.NEXT_PUBLIC_FASTIFY;
  if (!fastifyUrl) {
    return new Response(JSON.stringify({ error: 'Missing NEXT_PUBLIC_FASTIFY env var' }), { status: 500 });
  }

  const fastifyRes = await fetch(`${fastifyUrl}/api/avatars`, {
    method: 'POST',
    body: formData,
  });

  const data = await fastifyRes.json();

  if (!data.url || !data.success) {
    return new Response(JSON.stringify({ error: data.error || 'Fastify upload failed' }), { status: 500 });
  }

  const fullUrl = `${fastifyUrl}/data${data.url}`;

  await prisma.user.update({
    where: { id: userId },
    data: { avatar: fullUrl },
  });

  return new Response(JSON.stringify({ success: true, url: fullUrl }));
}
