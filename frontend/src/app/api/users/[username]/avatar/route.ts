import { auth } from '@/core/authServer';
import { fileTypeFromBuffer } from 'file-type';
import { prisma } from '@/core/prisma';
import { NextResponse } from 'next/server';
import { checkPermissions } from '@/components/serverSide/permCheck';

// Change Avatar
export async function POST(req: Request, context: { params: Promise<{ username: string }> }) {
  const prams = await context.params;
  const session = await auth();
  if (!session?.user?.id) { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }

  const targetUser = await prisma.user.findUnique({
    where: { username: prams.username },
    select: { id: true },
  });

  if (!targetUser) {
    return new Response(JSON.stringify({ error: 'User not found' }), { status: 404 });
  }

  const isSelf = session.user.id === targetUser.id;

  const perms = await checkPermissions([
    'profile_edit_avatar',
    'profile_edit_others'
  ]);

  if (isSelf) {
    if (!perms['profile_edit_avatar']) {
      return NextResponse.json({ error: "You are unauthorized to edit your avatar." }, { status: 403 });
    }
  } else {
    if (!perms['profile_edit_others']) {
      return NextResponse.json({ error: "You are unauthorized to edit other users' avatars." }, { status: 403 });
    }
  }

  const arrayBuffer = await req.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const fileType = await fileTypeFromBuffer(buffer);
  if (!fileType || !fileType.mime.startsWith('image/')) {
    return new Response(JSON.stringify({ error: `Unsupported or invalid image type. '${fileType?.mime}'` }), { status: 400 });
  }

  const blob = new Blob([buffer], { type: fileType.mime });
  const file = new File([blob], `avatar.${fileType.ext}`, { type: fileType.mime });

  const formData = new FormData();
  formData.append('userId', targetUser.id);
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
    return new Response(JSON.stringify({ error: `Fastify upload failed: ${data.error}` }), { status: 500 });
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: { avatar: `/data${data.url}` },
  });

  return new Response(JSON.stringify({ success: true, url: `${fastifyUrl}/data${data.url}` }));
}