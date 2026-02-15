import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { checkPermissions } from '@/components/serverSide/permCheck';
import { FILE_TYPE_MAP, FileType } from '@/core/dictionary';

export async function GET(req: Request) {
  const session = await auth();
  const hasPerms = (await checkPermissions(['post_view']))['post_view'];
  if (!session || !hasPerms) { return NextResponse.json({ error: "Unauthorized" }, { status: 401 }); };

  const { searchParams } = new URL(req.url);
  const postType = searchParams.get("type") || "";
  if (postType && !["image", "animated", "video", "other"].includes(postType)) { return NextResponse.json({ error: "Invalid Post Type" }, { status: 400 }); };

  const whereClause = postType 
    ? { 
        fileExt: { 
          in: FILE_TYPE_MAP[postType as FileType].map(ext => ext.replace('.', ''))
        } 
      }
    : {}
  ;

  try {
    const allPosts = await prisma.posts.count({ where: whereClause });
    const skip = Math.floor(Math.random() * allPosts);
    const post = await prisma.posts.findFirst({
      where: whereClause,
      skip,
      take: 1
    });
    return NextResponse.json({ post }, { status: 200 });
  } catch (e) {
    console.error('Failed to fetch storage stats:', e);
    return NextResponse.json({ error: "Failed to fetch random post" }, { status: 500 });
  }
}
