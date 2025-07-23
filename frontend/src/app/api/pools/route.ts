import { prisma } from "@/core/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";

// Listing current POOLS
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const rawQuery = searchParams.get("search")?.trim() || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");

  const andConditions = [];

  const orderMatch = rawQuery.match(/(?:^|\s)order:(\S+)(?=\s|$)/);
  const order = orderMatch?.[1] || "lastEdited";

  const yearMatch = rawQuery.match(/(?:^|\s)(\d{4})(?=\s|$)/);
  const year = yearMatch ? parseInt(yearMatch[1]) : null;

  const queryText = rawQuery
    .replace(/(?:^|\s)order:\S+(?=\s|$)/, "")
    .replace(/(?:^|\s)\d{4}(?=\s|$)/, "")
    .trim()
    .toLowerCase();

  if (queryText) {
    andConditions.push({
      OR: [
        { name: { contains: queryText, mode: Prisma.QueryMode.insensitive } },
        { artist: { contains: queryText, mode: Prisma.QueryMode.insensitive } }
      ]
    });
  }

  if (year) {
    andConditions.push({ yearStart: year });
  }

  const where = andConditions.length > 0 ? { AND: andConditions } : undefined;

  let orderBy: Prisma.PoolsOrderByWithRelationInput = { lastEdited: "desc" };

  if (order === "score") {
    orderBy = { score: "desc" };
  } else if (order === "score_asc") {
    orderBy = { score: "asc" };
  } else if (order === "size") {
    orderBy = { items: { _count: "desc" } };
  } else if (order === "size_asc") {
    orderBy = { items: { _count: "asc" } };
  }

  try {
    const total = await prisma.pools.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Clamp page to the highest available if it's too high
    const clampedPage = Math.min(page, Math.max(totalPages, 1));
    const skip = (clampedPage - 1) * limit;

    const rawPools = await prisma.pools.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        _count: {
          select: { items: true }
        },
        items: {
          orderBy: { index: 'asc'},
          take: 1,
          include: {
            post: {
              select: {
                id: true,
                fileExt: true,
                aspectRatio: true,
                previewPath: true,
                anonymous: true,
                flags: true,
                score: true,
                _count: {
                  select: {
                    favoritedBy: true
                  }
                }
              }
            }
          }
        }
      }
    });

    // Patch previewPath
    const baseUrl = process.env.NEXT_PUBLIC_FASTIFY?.replace(/\/$/, "");

    const pools = rawPools.map(pool => ({
      ...pool,
      items: pool.items.map(item => ({
        ...item,
        post: {
          ...item.post,
          previewPath: item.post.previewPath
            ? `${baseUrl}${item.post.previewPath}`
            : null
        }
      }))
    }));

    return NextResponse.json({ total, page: clampedPage, limit, pools });

  } catch (error) {
    console.error("Failed to fetch pools", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Creating new POOLS
export async function POST(req: Request) {
  const body = await req.json();
  const name = body?.name?.trim();
  const safety = body?.safety?.trim();
  const artist = body?.artist?.trim();
  let description = body?.description?.trim();
  const yearStart = body?.yearStart;
  const yearEnd = body?.yearEnd;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  if (!["SAFE", "SKETCHY", "UNSAFE"].includes(safety)) {
    return NextResponse.json({ error: "Safety must be either 'SAFE', 'SKETCHY', or 'UNSAFE'" }, { status: 400 });
  }

  if (description) {
    description = sanitizeHtml(description, {
      allowedTags: [],
      allowedAttributes: {}
    });

    if (description.length > 256) {
      return NextResponse.json(
        { error: "Description must be 256 characters or fewer" },
        { status: 400 }
      );
    }
  }

  try {
    const created = await prisma.pools.create({
      data: {
        name,
        artist,
        description,
        safety,
        yearEnd,
        yearStart
      }
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error("Failed to create pool", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}