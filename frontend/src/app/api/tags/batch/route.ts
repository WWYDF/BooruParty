import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import type { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

// Include set used for returned tag objects
const tagInclude = {
  category: true,
  aliases: true,
  implications: true,
  _count: { select: { posts: true } },
} satisfies Prisma.TagsInclude;

type TagWithRelations = Prisma.TagsGetPayload<{ include: typeof tagInclude }>;

type ReqBody = { names: string[] };

/**
 * Accepts names[], returns ONLY the matching tag objects (canonical),
 * considering both direct tag names and aliases (case-insensitive).
 */
export async function POST(req: NextRequest) {
  try {
    const { names } = (await req.json()) as ReqBody;
    if (!Array.isArray(names) || names.length === 0) {
      return NextResponse.json([]); // just an array of tags
    }

    const inputs = names.map(n => `${n ?? ''}`.trim()).filter(Boolean);
    if (inputs.length === 0) return NextResponse.json([]);

    const lowered = inputs.map(n => n.toLowerCase());
    const uniqLower = Array.from(new Set(lowered));

    // Direct tag name matches (case-insensitive OR list)
    const direct: TagWithRelations[] = await prisma.tags.findMany({
      where: {
        OR: uniqLower.map(lc => ({
          name: { equals: lc, mode: 'insensitive' as const },
        })),
      },
      include: tagInclude,
    });

    // Alias matches -> resolve to canonical tag
    const aliasRows = await prisma.tagAlias.findMany({
      where: {
        OR: uniqLower.map(lc => ({
          alias: { equals: lc, mode: 'insensitive' as const },
        })),
      },
      include: {
        tag: { include: tagInclude },
      },
    });

    // Collect unique canonical tags by ID
    const byId = new Map<number, TagWithRelations>();
    for (const t of direct) byId.set(t.id, t);
    for (const a of aliasRows) byId.set(a.tag.id, a.tag as TagWithRelations);

    const result = Array.from(byId.values());

    // If you prefer to preserve input order (first-appearance), rebuild order:
    // const order = new Map(result.map((t) => [t.name.toLowerCase(), inputs.findIndex(n => n.toLowerCase() === t.name.toLowerCase())]));
    // result.sort((a, b) => (order.get(a.name.toLowerCase()) ?? 1e9) - (order.get(b.name.toLowerCase()) ?? 1e9));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'resolve-batch failure' }, { status: 500 });
  }
}
