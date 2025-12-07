import { PrismaClient } from "@prisma/client";

type TestStatus = {
  test: string,
  passed: boolean,
  route: string
}

export async function systemCheckup(prisma?: PrismaClient): Promise<TestStatus[] | null> {
  const returnedTests: TestStatus[] = [];
  if (!prisma) { prisma = new PrismaClient() }

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


    const anyPreviewSizes = await prisma.posts.findFirst({
      where: { previewSize: { not: null } }
    });

    // Database is missing previewSize column. Tell user what route to use to fix.
    if (!anyPreviewSizes) {
      returnedTests.push({
        test: 'previewSizes',
        passed: false,
        route: 'POST /api/system/checks/database?test=previewSizes'
      });
    }

    const anyVideoMetadata = await prisma.posts.findFirst({
      where: {
        AND: [
          {
            fileExt: {
              in: ['mp4', 'webm', 'mkv'],
            },
          },
          {
            OR: [
              { duration: { not: null } },
              { hasAudio: { not: null } },
            ],
          },
        ],
      },
    });

    // Database is missing previewSize column. Tell user what route to use to fix.
    if (!anyVideoMetadata) {
      returnedTests.push({
        test: 'videoMeta',
        passed: false,
        route: 'POST /api/system/checks/database?test=videoMeta'
      });
    }

    return returnedTests;
  } catch (error) {
    return null;
  }
}

async function main() {
  console.log(`[Checks] Executing preliminary database checks...`);

  if (!process.env.INTERNAL_SHARED_SECRET) {
    console.error(`[Checks] INTERNAL_SHARED_SECRET is not defined in .env! Your site will not work properly.`);
    return 1;
  };

  const prisma = new PrismaClient();
  const checks = await systemCheckup(prisma);
  if (!checks) { console.error(`[Checks] Check failed! Read logs above for more information.`); return 1; };

  // In specific order
  if (checks.some(c => c.test === "OgPaths")) {
    await ogPaths(prisma);
  }

  if (checks.some(c => c.test === "previewSizes")) {
    await fixPreviewSizes(prisma);
  }

  if (checks.some(c => c.test === "videoMeta")) {
    await videoMeta(prisma);
  }

  console.log("[Checks] Checks finished with no errors. Starting Next Server...");
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

async function ogPaths(prisma: PrismaClient) {
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


////////////////////////////////////////////////////////////////////
//                                                                //
// TEST: Fix "Preview Sizes"!                                     //
//                                                                //
////////////////////////////////////////////////////////////////////

type PreviewItem = { // Matches Fastify
  id: number,
  previewPath: string,
}

type PreviewCheckBody = { // Matches Fastify
  items: PreviewItem[]
}

type PreviewSizeResult = { // Matches Fastify
  id: number,
  size: number | null,
}

async function fixPreviewSizes(prisma: PrismaClient) {
  const before = performance.now();
  try {
    const posts = await prisma.posts.findMany({
      where: { previewSize: null },
      select: { id: true, previewPath: true }
    });

    const body: PreviewCheckBody = {
      items: posts
        .filter(p => p.previewPath)
        .map(p => ({
          id: p.id,
          previewPath: p.previewPath!
        }))
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/checks/previews`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_SHARED_SECRET!
      }
    });

    const data: PreviewSizeResult[] = await response.json();
    if (!response.ok) { throw new Error(JSON.stringify(data, null, 0)) };

    // Handle posts in 500-post chunks to not overwhelm database (..too much)
    for (let i = 0; i < data.length; i += 500) {
      const chunk = data.slice(i, i + 500);

      await Promise.all(
        chunk.map((item) =>
          prisma.posts.update({
            where: { id: item.id },
            data: { previewSize: item.size },
          })
        )
      );
    }

    const after = performance.now();
    console.log(`Done updating previewSize for all posts. (${(after - before).toFixed(2)}ms)`);

  } catch (error) {
    console.error(`Something went wrong while fixing preview sizes!`, error);
  }
}


////////////////////////////////////////////////////////////////////
//                                                                //
// TEST: Fix "Video Metadata"!                                    //
// Adds "duration" and "hasAudio" columns to existing videos      //
//                                                                //
////////////////////////////////////////////////////////////////////

type IncomingItem = {
  id: number,
  originalPath: string,
}

type CheckBody = {
  items: IncomingItem[]
}

type VideoMetaResult = {
  id: number,
  duration: number | null,
  hasAudio: boolean | null,
}

async function videoMeta(prisma: PrismaClient) {
  const before = performance.now();
  try {
    const posts = await prisma.posts.findMany({
      where: { previewSize: null },
      select: { id: true, originalPath: true }
    });

    const body: CheckBody = {
      items: posts
        .filter(p => p.originalPath)
        .map(p => ({
          id: p.id,
          originalPath: p.originalPath!
        }))
    };

    const response = await fetch(`${process.env.NEXT_PUBLIC_FASTIFY}/api/checks/videoMeta`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_SHARED_SECRET!
      }
    });

    const data: VideoMetaResult[] = await response.json();
    if (!response.ok) { throw new Error(JSON.stringify(data, null, 0)) };

    // Handle posts in 500-post chunks to not overwhelm database (..too much)
    for (let i = 0; i < data.length; i += 500) {
      const chunk = data.slice(i, i + 500);

      await Promise.all(
        chunk.map((item) =>
          prisma.posts.update({
            where: { id: item.id },
            data: { duration: item.duration, hasAudio: item.hasAudio },
          })
        )
      );
    }

    const after = performance.now();
    console.log(`Done updating video metadata for all posts. (${(after - before).toFixed(2)}ms)`);

  } catch (error) {
    console.error(`Something went wrong while fixing video metadata!`, error);
  }
}


main();