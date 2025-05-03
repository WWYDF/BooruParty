import { prisma } from "@/core/prisma";
import { NextRequest, NextResponse } from "next/server";

// Get Pool Specific Data + All Posts in Pool
export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const prams = await context.params;
  const id = parseInt(prams.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
  }

  try {
    const pool = await prisma.pools.findUnique({
      where: { id },
      include: {
        _count: { select: { items: true } },
        items: {
          orderBy: { index: "asc" },
          select: {
            id: true,
            index: true,
            notes: true,
            post: {
              select: {
                id: true,
                safety: true,
                score: true,
                previewPath: true,
                aspectRatio: true,
                uploadedById: true,
                createdAt: true,
                _count: {
                  select: { favoritedBy: true }
                }
              }
            }
          }
        }
      }
    });

    if (!pool) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    // Normalize previewPath
    const base = process.env.NEXT_PUBLIC_FASTIFY?.replace(/\/$/, "");
    const withFullPaths = {
      ...pool,
      items: pool.items.map((item: any) => ({
        ...item,
        post: {
          ...item.post,
          previewPath: item.post.previewPath
            ? `${base}${item.post.previewPath}`
            : null
        }
      }))
    };

    return NextResponse.json(withFullPaths);
  } catch (err) {
    console.error("Failed to load pool", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Edit Pool Data
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const id = parseInt(params.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
  }

  const body = await req.json();
  const updates: { name?: string; artist?: string; description?: string } = {};

  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.artist !== undefined) updates.artist = body.artist.trim();
  if (body.description !== undefined) {
    const desc = body.description.trim();
    if (desc.length > 256) {
      return NextResponse.json({ error: "Description must be <= 256 characters" }, { status: 400 });
    }
    updates.description = desc;
  }

  try {
    const updated = await prisma.pools.update({
      where: { id },
      data: {
        ...updates,
        lastEdited: new Date()
      }
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Failed to update pool", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
