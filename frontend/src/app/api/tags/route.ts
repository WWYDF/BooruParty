import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "50");
  const search = searchParams.get("search") || "";
  const sort = searchParams.get("sort") || "name";
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";

  let categoryFilter: string | null = null;
  let strippedSearch = search;

  const totalTags = await prisma.tags.count();

  // Extract category:<name>
  const categoryMatch = search.match(/category:([^\s]+)/);
  if (categoryMatch) {
    categoryFilter = categoryMatch[1].toLowerCase();
    strippedSearch = search.replace(categoryMatch[0], "").trim();
  }

  const where = {
    AND: [
      categoryFilter
        ? {
            category: {
              name: {
                equals: categoryFilter,
                mode: Prisma.QueryMode.insensitive,
              },
            },
          }
        : {},
      strippedSearch
        ? {
            OR: [
              {
                name: {
                  contains: strippedSearch,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
              {
                aliases: {
                  some: {
                    alias: {
                      contains: strippedSearch,
                      mode: Prisma.QueryMode.insensitive,
                    },
                  },
                },
              },
            ],
          }
        : {},
    ],
  };

  let orderBy: Prisma.TagsFindManyArgs["orderBy"] = { name: order };
  let skip = (page - 1) * perPage;
  let take = perPage;

  if (sort === "usages") {
    skip = 0;
    take = 99999;
  } else if (sort === "category") {
    orderBy = { category: { name: order } };
  } else if (sort === "createdAt") {
    orderBy = { createdAt: order };
  }

  const tags = await prisma.tags.findMany({
    where,
    skip,
    take,
    orderBy,
    select: {
      id: true,
      name: true,
      category: {
        select: {
          id: true,
          name: true,
          color: true,
          order: true,
        }
      },
      aliases: {
        select: {
          alias: true
        }
      },
      implications: {
        select: {
          name: true
        }
      },
      suggestions: {
        select: {
          name: true
        }
      },
      _count: {
        select: {
          posts: true
        }
      },
      // posts: {
      //   select: {
      //     id: true
      //   }
      // },
      createdAt: true,
    },
  });

  const sortedTags = sort === "usages"
  ? tags.sort((a, b) =>
      order === "asc"
        ? a._count.posts - b._count.posts
        : b._count.posts - a._count.posts
    ).slice((page - 1) * perPage, page * perPage)
  : tags;

  const totalCount = await prisma.tags.count({ where });
  const totalPages = Math.ceil(totalCount / perPage);

  return NextResponse.json({
    totalPages,
    totalTags,
    tags: sortedTags
  });
}