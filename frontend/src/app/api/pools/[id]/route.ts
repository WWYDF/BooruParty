import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";
import { PoolItems } from "@prisma/client";
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
                fileExt: true,
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

    const session = await auth();
    let userVote: number | null = null;

    if (session?.user?.id) {
      const vote = await prisma.poolVotes.findUnique({
        where: {
          poolId_userId: {
            poolId: pool.id,
            userId: session.user.id,
          },
        },
        select: { vote: true },
      });

      userVote = vote?.vote ?? 0;
    }

    const userStuff = {
      vote: userVote,
      signedIn: !!session
    }

    // Normalize previewPath
    const base = process.env.NEXT_PUBLIC_FASTIFY?.replace(/\/$/, "");
    const withFullPaths = {
      ...pool,
      score: pool.score,
      items: pool.items.map((item: any) => ({
        ...item,
        post: {
          ...item.post,
          previewPath: item.post.previewPath
            ? `${base}${item.post.previewPath}`
            : null
        }
      })),
      user: userStuff
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
  const updates: {
    name?: string;
    artist?: string;
    safety?: 'SAFE' | 'SKETCHY' | 'UNSAFE';
    description?: string;
    yearStart?: number | null;
    yearEnd?: number | null;
  } = {};

  // === Metadata update handling ===
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.artist !== undefined) updates.artist = body.artist.trim();
  if (body.safety !== undefined) updates.safety = body.safety.trim();
  if (body.description !== undefined) {
    const desc = body.description.trim();
    if (desc.length > 256) {
      return NextResponse.json({ error: "Description must be <= 256 characters" }, { status: 400 });
    }
    updates.description = desc;
  }

  if (body.yearStart !== undefined) {
    const start = parseInt(body.yearStart);
    if (!isNaN(start)) updates.yearStart = start;
    else updates.yearStart = null;
  }
  
  if (body.yearEnd !== undefined) {
    const end = parseInt(body.yearEnd);
    updates.yearEnd = isNaN(end) ? null : end;
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

  const rawPostIds = body?.postId ?? body?.postIds;
  const postIds: number[] = Array.isArray(rawPostIds)
    ? rawPostIds.map(id => parseInt(id)).filter(id => !isNaN(id))
    : [parseInt(rawPostIds)].filter(id => !isNaN(id));

  if (!postIds.length) {
    return NextResponse.json({ error: "Missing or invalid postId(s)" }, { status: 400 });
  }

  try {
    const newItems: PoolItems[] = [];

    // Get current highest index in pool
    const lastItem = await prisma.poolItems.findFirst({
      where: { poolId },
      orderBy: { index: "desc" },
      select: { index: true },
    });

    let currentIndex = lastItem?.index ?? -1;

    for (let i = 0; i < postIds.length; i++) {
      const postId = postIds[i];

      const existing = await prisma.poolItems.findUnique({
        where: { poolId_postId: { poolId, postId } },
      });

      if (!existing) {
        currentIndex += 1;

        const newItem: PoolItems = await prisma.poolItems.create({
          data: {
            poolId,
            postId,
            index: currentIndex,
          },
        });

        newItems.push(newItem);
      }
    }

    if (newItems.length === 0) {
      return NextResponse.json({ error: "All posts already in pool" }, { status: 409 });
    }

    return NextResponse.json(newItems.length === 1 ? newItems[0] : newItems, { status: 201 });
  } catch (err) {
    console.error("Failed to add post(s) to pool", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// Deleting POOL (Does not delete posts)
export async function DELETE(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const poolId = parseInt(id);
  if (isNaN(poolId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  try {
    await prisma.poolItems.deleteMany({ where: { poolId } });
    await prisma.pools.delete({ where: { id: poolId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete pool:", err);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}