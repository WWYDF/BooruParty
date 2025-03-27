import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  context: { params: Promise<{ name: string }> }
) {
  const { name } = await context.params;

  const tag = await prisma.tags.findFirst({
    where: {
      names: { has: name },
    },
    include: {
      category: true,
      implications: {
        select: { id: true, names: true },
      },
      suggestions: {
        select: { id: true, names: true },
      },
    },
  });

  if (!tag || tag.names[0] !== name) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  return NextResponse.json(tag);
}
