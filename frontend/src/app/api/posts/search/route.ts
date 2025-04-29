import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

function parseSearch(input: string) {
  const terms = input.split(/\s+/).filter(Boolean);

  const includeTags: string[] = [];
  const excludeTags: string[] = [];

  for (const term of terms) {
    if (term.startsWith("-")) {
      excludeTags.push(term.substring(1));
    } else {
      includeTags.push(term);
    }
  }

  return { includeTags, excludeTags };
}


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("query") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "50");

  const { includeTags, excludeTags } = parseSearch(search);

  const posts = await prisma.posts.findMany({
    where: {
      AND: [
        ...includeTags.map((tagName) => ({
          tags: { some: { name: tagName } },
        })),
        ...excludeTags.map((tagName) => ({
          tags: { none: { name: tagName } },
        })),
      ],
    },
    skip: (page - 1) * perPage,
    take: perPage,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileExt: true,
      safety: true,
      uploadedBy: true,
      anonymous: true,
      flags: true,
      score: true,
      favoritedBy: {
        select: {
          userId: true
        }
      },
      comments: {
        select: {
          authorId: true,
          content: true
        }
      },
      createdAt: true,
      tags: { select: { id: true, name: true } },
    },
  });

  const totalCount = await prisma.posts.count({
    where: {
      AND: [
        ...includeTags.map((tagName) => ({
          tags: { some: { name: tagName } },
        })),
        ...excludeTags.map((tagName) => ({
          tags: { none: { name: tagName } },
        })),
      ],
    },
  });

  const totalPages = Math.ceil(totalCount / perPage);

  return NextResponse.json({
    posts,
    totalPages,
  });
}