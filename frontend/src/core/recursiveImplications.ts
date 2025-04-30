import { prisma } from "@/core/prisma";

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
        },
      },
    },
  });

  if (!tag) return [];

  const direct = tag.implications;
  const deeper = await Promise.all(direct.map((t) => fetchAllImplications(t.id, seen)));
  return [...direct, ...deeper.flat()];
}
