import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

async function resolveTagIds(include: string[], exclude: string[]) {
  const tagNames = await prisma.tagName.findMany({
    where: {
      name: {
        in: [...include, ...exclude],
      },
    },
  });

  const includedTagIds = tagNames
    .filter((n) => include.includes(n.name))
    .map((n) => n.tagId);

  const excludedTagIds = tagNames
    .filter((n) => exclude.includes(n.name))
    .map((n) => n.tagId);

  return { includedTagIds, excludedTagIds };
}

async function getPostIdsMatchingIncludedTags(includedTagIds: number[]) {
  if (includedTagIds.length === 0) return []; // intentionally return [] so logic works consistently

  const group = await prisma.postTag.groupBy({
    by: ["postId"],
    where: {
      tagId: { in: includedTagIds },
    },
    having: {
      tagId: {
        _count: {
          equals: includedTagIds.length,
        },
      },
    },
  });

  return group.map((g) => g.postId);
}

async function fetchPosts(
  postIds: number[] | undefined,
  excludedTagIds: number[],
  options: any
) {
  return prisma.posts.findMany({
    where: {
      ...(postIds ? { id: { in: postIds } } : {}),
      postTags: {
        none: excludedTagIds.length
          ? {
              tagId: { in: excludedTagIds },
            }
          : undefined,
      },
    },
    include: {
      postTags: {
        include: {
          tag: {
            include: {
              parentTag: {
                include: {
                  names: true,
                  category: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy:
      options.order === "score"
        ? { score: "desc" }
        : options.order === "new"
        ? { createdAt: "desc" }
        : undefined,
    take: typeof options.limit === "number" ? options.limit : 50,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { include = [], exclude = [], options = {} } = body;

    const { includedTagIds, excludedTagIds } = await resolveTagIds(include, exclude);

    let postIds: number[] | undefined = undefined;

    if (includedTagIds.length > 0) {
      postIds = await getPostIdsMatchingIncludedTags(includedTagIds);

      // No matches = no posts
      if (postIds.length === 0) {
        return NextResponse.json([]);
      }
    }

    const posts = await fetchPosts(postIds, excludedTagIds, options);

    return NextResponse.json(posts);
  } catch (err) {
    console.error("Search failed:", err);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }
}
