import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';
import { reportAudit } from '@/components/serverSide/auditLog';

export async function GET() {
  const session = await auth();

  if (!session && process.env.GUEST_VIEWING !== 'true') { return NextResponse.json({ error: 'Guest viewing is disabled and you are not logged in.' }, { status: 403 }); }

  try {
    const special = await prisma.specialPosts.findUnique({
      where: { label: 'topWeek' },
      include: {
        post: true
      },
    });

    if (!special || !special.post) {
      return NextResponse.json({ error: 'No featured post found' }, { status: 404 });
    }

    const postFormatted = {
      ...special,
      post: {
        ...special.post,
        previewPath: `${process.env.NEXT_PUBLIC_FASTIFY}${special.post.previewPath}`
      }
    }

    return NextResponse.json({ data: postFormatted });
  } catch (error) {
    console.error('Error fetching topWeek post:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { postId, type } = body;

  if (!type) {
    return NextResponse.json({ error: "Missing feature type." }, { status: 400 });
  }

  // Check for feature permission
  const hasPerms = (await checkPermissions(['post_feature']))['post_feature'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  // Remove current post
  if (!postId) {
    await prisma.specialPosts.delete({
      where: { label: type }
    })
    await reportAudit(session.user.id, 'DELETE', 'FEATURE', `Feature Type: ${type}`);
    return NextResponse.json(`Successfully removed featured for ${type}.`, { status: 200 });
  }

  // Create or update the specialPost
  await prisma.specialPosts.upsert({
    where: { label: type },
    update: { postId },
    create: { label: type, postId }
  })

  await reportAudit(session.user.id, 'UPDATE', 'FEATURE', undefined, `Feature Type: ${type}, New PostID: ${postId}`);

  return NextResponse.json(`Successfully featured post #${postId} for ${type}.`, { status: 201 });
}