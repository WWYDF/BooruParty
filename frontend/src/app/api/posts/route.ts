import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { SafetyType } from "@prisma/client";

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


export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const search = searchParams.get("query") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "50");
  const safetyValues = searchParams.getAll("safety");

  const { includeTags, excludeTags, systemOptions } = parseSearch(search);

  const orderValue = systemOptions.order || "createdAt"; // default to createdAt
  let orderBy: any = { createdAt: "desc" };

  if (orderValue.startsWith("score")) {
    orderBy = { score: orderValue.endsWith("_asc") ? "asc" : "desc" };
  } else if (orderValue.startsWith("favorites")) {
    orderBy = { favoritedBy: { _count: orderValue.endsWith("_asc") ? "asc" : "desc" } };
  } else if (orderValue.startsWith("tag_count")) {
    orderBy = { tags: { _count: orderValue.endsWith("_asc") ? "asc" : "desc" } };
  } else {
    orderBy = { createdAt: "desc" }; // fallback
  }

  const uploaderWhere = systemOptions.posts
  ? {
      uploadedBy: {
        is: {
          username: systemOptions.posts,
        },
      },
    }
  : {};

  const favoriterWhere = systemOptions.favorites
  ? {
      favoritedBy: {
        some: {
          user: {
            username: systemOptions.favorites,
          },
        },
      },
    }
  : {};

  const posts = await prisma.posts.findMany({
    where: {
      AND: [
        uploaderWhere,
        favoriterWhere,
        ...(safetyValues.length > 0
          ? [{ safety: { in: safetyValues as SafetyType[] } }]
          : []),
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
    orderBy,
    select: {
      id: true,
      fileExt: true,
      safety: true,
      uploadedBy: {
        select: { id: true, username: true }
      },
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
        uploaderWhere,
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