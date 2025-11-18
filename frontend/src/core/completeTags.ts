import { prisma } from "@/core/prisma";
import { Tag } from "./types/tags";

export type TagWithAllImplications = Tag & {
  allImplications: {
    id: number;
    name: string;
    description: string | null;
    category: {
      id: number;
      name: string;
      color: string;
    };
    _count: {
      posts: number;
    };
  }[];
};

export async function fetchAllImplications(tagId: number, seen = new Set<number>()): Promise<any> {
  if (seen.has(tagId)) return [];

  seen.add(tagId);

  const tag = await prisma.tags.findUnique({
    where: { id: tagId },
    select: {
      implications: {
        select: {
          id: true,
          name: true,
          description: true,
          category: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
          _count: {
            select: {
              posts: true
            }
          }
        },
      },
    },
  });

  if (!tag) return [];

  const direct = tag.implications;
  const deeper = await Promise.all(direct.map((t) => fetchAllImplications(t.id, seen)));
  return [...direct, ...deeper.flat()];
}


export async function fetchTag(tagName: string): Promise<TagWithAllImplications | null> {
  // Try exact match
  let tag = await prisma.tags.findUnique({
    where: { name: tagName },
    include: {
      category: true,
      aliases: true,
      implications: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
        }
      },
      suggestions: {
        select: {
          id: true,
          name: true,
          description: true,
          category: true,
        }
      },
      _count: { select: { posts: true } },
    },
  });

  // If not found, try alias match
  if (!tag) {
    const alias = await prisma.tagAlias.findUnique({
      where: { alias: tagName },
      include: {
        tag: {
          include: {
            category: true,
            aliases: true,
            implications: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
              }
            },
            suggestions: {
              select: {
                id: true,
                name: true,
                description: true,
                category: true,
              }
            },
            _count: { select: { posts: true } },
          },
        },
      },
    });

    tag = alias?.tag ?? null;
  }

  if (!tag) { return null };

  const allImplications = await fetchAllImplications(tag.id);

  return {
    ...tag,
    allImplications
  }
}