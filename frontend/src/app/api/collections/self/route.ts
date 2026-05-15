import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/core/prisma';
import { auth } from '@/core/authServer';
import { z } from 'zod';

const createSchema = z.object({
  name: z.string().min(1).max(64),
  isPublic: z.boolean().optional().default(true),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(64).optional(),
  isPublic: z.boolean().optional(),
  addPostId: z.number().int().positive().optional(),
  removePostId: z.number().int().positive().optional(),
});

// Creating a new Collection
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { name, isPublic } = parsed.data;

  const collection = await prisma.collection.create({
    data: {
      ownerId: session.user.id,
      name,
      isPublic,
    },
  });

  return NextResponse.json({ collection }, { status: 201 });
}

// Editing a Collection (rename, visibility, add/remove posts)
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse('Unauthorized', { status: 401 });

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid data', issues: parsed.error.flatten() }, { status: 400 });
  }

  const { id, name, isPublic, addPostId, removePostId } = parsed.data;

  const existing = await prisma.collection.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
  }
  if (existing.ownerId !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const updates: { name?: string; isPublic?: boolean } = {};
  if (name !== undefined) updates.name = name;
  if (isPublic !== undefined) updates.isPublic = isPublic;

  const [collection] = await prisma.$transaction(async (tx) => {
    if (addPostId !== undefined) {
      await tx.collectionItem.upsert({
        where: { collectionId_postId: { collectionId: id, postId: addPostId } },
        create: { collectionId: id, postId: addPostId },
        update: {},
      });
    }

    if (removePostId !== undefined) {
      await tx.collectionItem.deleteMany({
        where: { collectionId: id, postId: removePostId },
      });
    }

    const updated = await tx.collection.update({
      where: { id },
      data: { ...updates, updatedAt: new Date() },
      include: { items: true, _count: true },
    });

    return [updated];
  });

  return NextResponse.json({ collection });
}
