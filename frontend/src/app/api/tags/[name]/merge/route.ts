import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

export async function POST(req: Request, context: { params: Promise<{ name: string }> }) {
  const pram = (await context.params).name;
  const sourceName = decodeURIComponent(pram);
  const { targetId, makeAlias } = await req.json();

  if (!targetId || typeof makeAlias !== "boolean") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const source = await prisma.tags.findUnique({
      where: { name: sourceName },
      select: { id: true, name: true },
    });

    if (!source) {
      return NextResponse.json({ error: "Source tag not found" }, { status: 404 });
    }

    const sourceId = source.id;

    if (sourceId === targetId) {
      return NextResponse.json({ error: "Cannot merge a tag into itself." }, { status: 400 });
    }

    // Step 1: Move Post usages
    const posts = await prisma.posts.findMany({
      where: {
        tags: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      posts.map((post: any) =>
        prisma.posts.update({
          where: { id: post.id },
          data: {
            tags: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Step 2: Move Implications (both directions)

    // Implications where source → other
    const implies = await prisma.tags.findMany({
      where: {
        impliedBy: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      implies.map((tag: any) =>
        prisma.tags.update({
          where: { id: tag.id },
          data: {
            impliedBy: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Implications where other → source
    const impliedBy = await prisma.tags.findMany({
      where: {
        implications: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      impliedBy.map((tag: any) =>
        prisma.tags.update({
          where: { id: tag.id },
          data: {
            implications: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Step 3: Move Suggestions (both directions)

    // Suggestions where source → other
    const suggests = await prisma.tags.findMany({
      where: {
        suggestedBy: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      suggests.map((tag: any) =>
        prisma.tags.update({
          where: { id: tag.id },
          data: {
            suggestedBy: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Suggestions where other → source
    const suggestedBy = await prisma.tags.findMany({
      where: {
        suggestions: {
          some: { id: sourceId },
        },
      },
      select: { id: true },
    });

    await prisma.$transaction(
      suggestedBy.map((tag: any) =>
        prisma.tags.update({
          where: { id: tag.id },
          data: {
            suggestions: {
              disconnect: { id: sourceId },
              connect: { id: targetId },
            },
          },
        })
      )
    );

    // Step 4: Optionally create an alias for source name
    if (makeAlias) {
      const exists = await prisma.tagAlias.findFirst({
        where: { alias: source.name },
      });

      if (!exists) {
        await prisma.tagAlias.create({
          data: {
            alias: source.name,
            tagId: targetId,
          },
        });
      }
    }

    // Step 5: Clean up: Delete source tag
    await prisma.tagAlias.deleteMany({
      where: { tagId: sourceId },
    });

    await prisma.tags.delete({
      where: { id: sourceId },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TAG_MERGE]", err);
    return NextResponse.json({ error: "Failed to merge tag." }, { status: 500 });
  }
}
