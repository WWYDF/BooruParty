import { prisma } from "./prisma";


type TestStatus = {
  test: string,
  passed: boolean,
  route: string
}

export async function systemCheckup(): Promise<TestStatus[] | null> {
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
        OR: [
          { duration: { not: null } },
          { hasAudio: { not: null }}
        ]
      }
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