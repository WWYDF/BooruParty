import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';

export async function GET() {
  const session = await auth();
  const hasPerms = (await checkPermissions(['post_view']))['post_view'];
  if (!session || !hasPerms) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); };

  try {
    const allPosts = await prisma.posts.count();
    const skip = Math.floor(Math.random() * allPosts);
    const post = await prisma.posts.findFirst({
      skip,
      take: 1
    });
    return NextResponse.json({ post }, { status: 200 });
  } catch (e) {
    console.error('Failed to fetch storage stats:', e);
    return NextResponse.json({ error: "Failed to fetch random post" }, { status: 500 });
  }
}
