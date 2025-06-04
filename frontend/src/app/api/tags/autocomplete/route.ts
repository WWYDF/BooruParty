import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { fetchAllImplications } from "@/core/recursiveImplications";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || query.trim() === "") {
    return NextResponse.json({ error: "Missing search query" }, { status: 400 });
  }

  const searchTerm = query.trim();
  const LIMIT = 10;

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
    include: { category: true, aliases: true, implications: true },
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
          implications: true
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

  const allTags = Array.from(allTagsMap.values());

  const tagsWithImplications = await Promise.all(
    allTags.map(async (tag) => {
      const allImplications = await fetchAllImplications(tag.id);
      return { ...tag, allImplications };
    })
  );
  
  return NextResponse.json(tagsWithImplications);
}