import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { fetchAllImplications } from "@/core/completeTags";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || query.trim() === "") {
    return NextResponse.json({ error: "Missing search query" }, { status: 400 });
  }

  const searchTerm = query.trim();
  const LIMIT = 20;

  // First find exact matches.
  const exactMatches = await prisma.tags.findMany({
    where: {
      name: {
        equals: searchTerm,
        mode: "insensitive",
      },
    },
    include: {
      category: true,
      aliases: true,
      implications: true,
      _count: { select: { posts: true }},
    },
  });

  // Then, find tags that start with the name
  const startsWithMatches = await prisma.tags.findMany({
    where: {
      name: {
        startsWith: searchTerm,
        mode: "insensitive",
      },
      NOT: {
        name: {
          equals: searchTerm,
          mode: "insensitive",
        },
      },
    },
    include: {
      category: true,
      aliases: true,
      implications: true,
      _count: { select: { posts: true }},
    },
  });

  // Then, find Tags containing name
  const containsMatches = await prisma.tags.findMany({
    where: {
      name: {
        contains: searchTerm,
        mode: "insensitive",
      },
      // Exclude exact match to avoid duplication
      NOT: {
        name: {
          equals: searchTerm,
          mode: "insensitive",
        },
      },
    },
    include: {
      category: true,
      aliases: true,
      implications: true,
      _count: { select: { posts: true }},
    },
    take: LIMIT - (exactMatches.length + startsWithMatches.length),
  });

  // Finally, find Aliases matching the search term
  const aliases = await prisma.tagAlias.findMany({
    where: {
      alias: {
        contains: searchTerm,
        mode: "insensitive",
      },
    },
    include: {
      tag: {
        include: {
          category: true,
          aliases: true,
          implications: true,
          _count: {
            select: { posts: true }
          }
        },
      },
    },
  });

  const tagsByName = [...exactMatches, ...startsWithMatches, ...containsMatches];

  // Flatten aliases to tags
  const tagsFromAliases = aliases.map((a) => a.tag);

  // Combine + de-duplicate by Tag ID
  const allTagsMap = new Map<number, typeof tagsByName[0]>();
  for (const tag of [...tagsByName, ...tagsFromAliases]) {
    if (!allTagsMap.has(tag.id)) {
      allTagsMap.set(tag.id, tag);
    }
  }

  for (const tag of [...tagsByName, ...tagsFromAliases]) {
    allTagsMap.set(tag.id, tag); // Map automatically deduplicates
  }

  const allTagsArray = Array.from(allTagsMap.values());

  let sortedTags: typeof allTagsArray = [];
  if (exactMatches.length > 0) {
    const topTag = exactMatches[0]; // the exact match stays at the top
    const rest = allTagsArray.filter((t) => t.id !== topTag.id);
    rest.sort((a, b) => (b._count?.posts ?? 0) - (a._count?.posts ?? 0));
    sortedTags = [topTag, ...rest];
  } else {
    sortedTags = allTagsArray.sort((a, b) => (b._count?.posts ?? 0) - (a._count?.posts ?? 0));
  }

  const tagsWithImplications = await Promise.all(
    sortedTags.map(async (tag) => {
      const allImplications = await fetchAllImplications(tag.id);
      return { ...tag, allImplications };
    })
  );
  
  return NextResponse.json(tagsWithImplications);
}