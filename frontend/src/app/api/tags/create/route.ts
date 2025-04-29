import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

export async function POST(req: Request) {
  const { name, categoryId } = await req.json();

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const existing = await prisma.tags.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json({ error: "Tag already exists." }, { status: 400 });
    }

    await prisma.tags.create({
      data: {
        name,
        categoryId: categoryId || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TAG_CREATE]", err);
    return NextResponse.json({ error: "Failed to create tag." }, { status: 500 });
  }
}