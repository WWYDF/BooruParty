import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/auth';
import { checkPermissions } from '@/components/serverSide/permCheck';
import { reportAudit } from '@/components/serverSide/auditLog';

export async function GET() {
  try {
    const special = await prisma.specialPosts.findUnique({
      where: { label: 'topWeek' },
      include: {
        post: {
          select: {
            id: true,
            fileExt: true,
            createdAt: true,
            previewScale: true,
          },
        },
      },
    });

    if (!special || !special.post) {
      return NextResponse.json({ error: 'No featured post found' }, { status: 404 });
    }

    return NextResponse.json({ post: special.post });
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

  // Remove current post
  if (!postId) {
    await prisma.specialPosts.delete({
      where: { label: type }
    })
    await reportAudit(session.user.id, 'DELETE', 'FEATURE', `Feature Type: ${type}`);
    return NextResponse.json(`Successfully removed featured for ${type}.`, { status: 200 });
  }

  // --- Check for embed permission
  const hasPerms = (await checkPermissions(['post_feature']))['post_feature'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to view the contents of this page." }, { status: 403 }); }

  // Create or update the specialPost
  await prisma.specialPosts.upsert({
    where: { label: type },
    update: { postId },
    create: { label: type, postId }
  })

  await reportAudit(session.user.id, 'UPDATE', 'FEATURE', `Feature Type: ${type}, New PostID: ${postId}`);

  return NextResponse.json(`Successfully featured post #${postId} for ${type}.`, { status: 201 });
}