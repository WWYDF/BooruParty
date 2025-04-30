import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  if (!query || query.trim() === "") {
    return NextResponse.json({ error: "Missing search query" }, { status: 400 });
  }

  const searchTerm = query.trim();
  const LIMIT = 10;

  // First, find Tags matching directly by name
  const tagsByName = await prisma.tags.findMany({
    where: {
      name: {
        contains: searchTerm,
        mode: "insensitive", // case-insensitive
      },
    },
    include: {
      category: true,
      aliases: true,
      implications: true
    },
    take: LIMIT,
  });

  // Then, find Aliases matching the search term
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
    take: LIMIT * 2,
  });

  // Flatten aliases to tags
  const tagsFromAliases = aliases.map((a) => a.tag);

  // Combine + de-duplicate by Tag ID
  const allTagsMap = new Map<number, typeof tagsByName[0]>();

  for (const tag of [...tagsByName, ...tagsFromAliases]) {
    allTagsMap.set(tag.id, tag); // Map automatically deduplicates
  }

  const allTags = Array.from(allTagsMap.values());

  return NextResponse.json(allTags);
}