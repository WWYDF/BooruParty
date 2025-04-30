import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';

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
