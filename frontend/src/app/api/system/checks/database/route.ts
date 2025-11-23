import { NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { checkPermissions } from '@/components/serverSide/permCheck';

type TestStatus = {
  test: string,
  passed: boolean,
  route: string
}

export async function GET() {
  const hasPerms = (await checkPermissions(['dashboard_update']))['dashboard_update'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const returnedTests: TestStatus[] = [];

  try {
    const anyOgPaths = await prisma.posts.findFirst({
      where: { originalPath: { not: null } }
    });

    // Database is missing ogPath column. Tell user what route to use to fix.
    if (!anyOgPaths) {
      returnedTests.push({
        test: 'OgPaths',
        passed: false,
        route: 'POST /api/system/checks/database?test=OgPaths'
      });
    }
    
    return NextResponse.json({ tests: returnedTests });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to run database tests.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const hasPerms = (await checkPermissions(['dashboard_update']))['dashboard_update'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const url = new URL(req.url);
  const test = url.searchParams.get("test");

  if (!test) return NextResponse.json({ error: "No test specified"}, { status: 400 });

  const beforeTime = performance.now();
  switch (test) {
    case 'OgPaths':
      await fixOriginalPath();
      break;
  }

  return NextResponse.json({ success: true, elapsed: `${((performance.now() - beforeTime) / 1000).toFixed(2) } seconds`});
}


////////////////////////////////////////////////////////////////////
// TEST: Fix "Original Path"!                                     //
// Below is a preserved version of the original file type map.    //
//                                                                //
// Should be run prior to using the update!                       //
////////////////////////////////////////////////////////////////////

const ORIGINAL_FTM: Record<string, string[]> = {
  image: ['.png', '.jpg', '.jpeg', '.webp', '.bmp', '.tiff'],
  animated: ['.gif', '.apng'],
  video: ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.quicktime'],
  other: []
};

function getFileType(ext: string): string {
  const lower = ext.toLowerCase();

  for (const [type, exts] of Object.entries(ORIGINAL_FTM)) {
    if (exts.includes("." + lower.replace(/^\./, ""))) {
      return type;
    }
  }
  return "other";
}


async function fixOriginalPath() {
  const before = performance.now();
  const posts = await prisma.posts.findMany({
    where: { originalPath: { equals: null } },
    select: {
      id: true,
      fileExt: true,
    },
  });

  for (const post of posts) {
    const type = getFileType(post.fileExt);
    const originalPath = `/data/uploads/${type}/${post.id}.${post.fileExt}`;
    await prisma.posts.update({
      where: { id: post.id },
      data: { originalPath },
    });
  }
  const after = performance.now();
  console.log(`Done fixing originalPath for all posts. (${(after - before).toFixed(2)}ms)`);
}