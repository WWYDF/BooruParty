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
