// app/api/tags/[name]/route.ts

import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

export async function GET(req: Request, context: { params: Promise<{ name: string }> }) {
  const tagName = (await context.params).name;

  // Try exact match
  let tag = await prisma.tags.findUnique({
    where: { name: tagName },
    include: {
      category: true,
      aliases: true,
      implications: true,
      suggestions: true,
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
            implications: true,
            suggestions: true,
          },
        },
      },
    });

    tag = alias?.tag ?? null;
  }

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return NextResponse.json(tag);
}

export async function DELETE(req: Request, context: { params: Promise<{ name: string }> }) {
  const pram = (await context.params).name;
  const tagName = decodeURIComponent(pram);

  try {
    const tag = await prisma.tags.findUnique({
      where: { name: tagName },
      select: { id: true },
    });

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Delete all aliases for the tag
    await prisma.tagAlias.deleteMany({
      where: { tagId: tag.id },
    });

    // Delete the tag itself
    await prisma.tags.delete({
      where: { id: tag.id },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TAG_DELETE]", err);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}