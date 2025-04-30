import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { z } from "zod";
import { SafetyType } from "@prisma/client";
import { appLogger } from "@/core/logger";

function parseSearch(input: string) {
  const terms = input.split(/\s+/).filter(Boolean);

  const includeTags: string[] = [];
  const excludeTags: string[] = [];
  const systemOptions: Record<string, string> = {};

  for (const term of terms) {
    if (term.startsWith("-")) {
      excludeTags.push(term.substring(1));
    } else if (term.includes(":")) {
      const [key, value] = term.split(":");
      if (key && value) {
        systemOptions[key] = value;
      }
    } else {
      includeTags.push(term);
    }
  }

  return { includeTags, excludeTags, systemOptions };
}

const querySchema = z.object({
  current: z.coerce.number(),
  query: z.string().optional(),
  safety: z.string().optional(),
  sort: z.enum(["new", "old"]).default("new"),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const { current, query: rawQuery = "", safety, sort } = query;
    const { includeTags, excludeTags } = parseSearch(rawQuery);

    const whereClause: any = { AND: [] };

    // Tags
    for (const tag of includeTags) {
      whereClause.AND.push({ tags: { some: { name: tag } } });
    }

    for (const tag of excludeTags) {
      whereClause.AND.push({ tags: { none: { name: tag } } });
    }

    // Safety
    if (safety) {
      const safeties = safety.split("-").filter(Boolean) as SafetyType[];
      if (safeties.length > 0) {
        whereClause.AND.push({ safety: { in: safeties } });
      }
    }

    // Order + lookup
    const orderedPosts = await prisma.posts.findMany({
      where: whereClause,
      select: { id: true },
      orderBy: { createdAt: sort === "old" ? "asc" : "desc" },
    });

    const idList = orderedPosts.map((p) => p.id);
    const currentIndex = idList.indexOf(current);

    let previousPostId = 0;
    let nextPostId = 0;

    if (currentIndex !== -1) {
      if (sort === "new") {
        previousPostId = idList[currentIndex + 1] ?? 0;
        nextPostId = idList[currentIndex - 1] ?? 0;
      } else {
        previousPostId = idList[currentIndex - 1] ?? 0;
        nextPostId = idList[currentIndex + 1] ?? 0;
      }
    }

    return NextResponse.json({
      previousPostId,
      nextPostId,
    });
  } catch (error) {
    appLogger.error("[GET /api/posts/navigate]", error);
    return NextResponse.json({ error: "Failed to determine next/previous post." }, { status: 500 });
  }
}
