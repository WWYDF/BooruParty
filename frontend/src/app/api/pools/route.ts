import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";
import sanitizeHtml from "sanitize-html";

// Listing current POOLS
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const query = searchParams.get("search")?.trim() || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");

  const skip = (page - 1) * limit;
  let total;
  let rawPools;

  try {
    [total, rawPools] = await Promise.all([
      prisma.pools.count({
        where: query
          ? { name: { contains: query, mode: "insensitive" } }
          : undefined
      }),

      prisma.pools.findMany({
        where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { artist: { contains: query, mode: "insensitive" } }
            ]
          }
        : undefined,
        orderBy: { lastEdited: "desc" },
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
      })
    ]);

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

    return NextResponse.json({ total, page, limit, pools });

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
  const yearStart = body?.yearStart?.trim();
  const yearEnd = body?.yearEnd?.trim();

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