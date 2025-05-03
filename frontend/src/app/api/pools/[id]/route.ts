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

// Edit Order of Posts AND/OR Edit Pool Metadata
export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const prams = await context.params;
  const id = parseInt(prams.id);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
  }

  const body = await req.json();
  const updates: { name?: string; artist?: string; description?: string } = {};

  // === Metadata update handling ===
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
    // Apply metadata if provided
    if (Object.keys(updates).length > 0) {
      await prisma.pools.update({
        where: { id },
        data: {
          ...updates,
          lastEdited: new Date()
        }
      });
    }

    // === Reordering handling ===
    if (Array.isArray(body.order)) {
      const tempOffset = 10000; // high enough to not conflict

      // Step 1: temporarily offset all indices
      await Promise.all(
        body.order.map(({ id }: any) =>
          prisma.poolItems.update({
            where: { id },
            data: { index: { increment: tempOffset } }
          })
        )
      );

      // Step 2: apply correct final indices
      await Promise.all(
        body.order.map(({ id, index }: { id: number; index: number }) =>
          prisma.poolItems.update({
            where: { id },
            data: { index }
          })
        )
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to update pool", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Add Posts to this Pool
export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const prams = await context.params;
  const poolId = parseInt(prams.id);
  if (isNaN(poolId)) {
    return NextResponse.json({ error: "Invalid pool ID" }, { status: 400 });
  }

  const body = await req.json();
  const postId = parseInt(body?.postId);

  if (!postId || isNaN(postId)) {
    return NextResponse.json({ error: "Missing or invalid postId" }, { status: 400 });
  }

  try {
    const existing = await prisma.poolItems.findUnique({
      where: { poolId_postId: { poolId, postId } }
    });

    if (existing) {
      return NextResponse.json({ error: "Post already in pool" }, { status: 409 });
    }

    const currentCount = await prisma.poolItems.count({ where: { poolId } });

    const newItem = await prisma.poolItems.create({
      data: {
        poolId,
        postId,
        index: currentCount
      }
    });

    return NextResponse.json(newItem, { status: 201 });
  } catch (err) {
    console.error("Failed to add post to pool", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
