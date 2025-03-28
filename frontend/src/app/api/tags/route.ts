import { auth } from "@/core/auth";
import { prisma } from "@/core/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const searchParam = url.searchParams.get('search');
    const tag = searchParam ? String(searchParam) : undefined;

    if (tag) {
        try {
            const prismaSearch = await prisma.tagName.findMany({
              where: {
                name: {
                  contains: tag,
                  mode: 'insensitive',
                },
              },
              include: {
                parentTag: {
                  include: {
                    names: true, // Include all names (aliases + canonical)
                    category: true, // Optional: if you want the category too
                  },
                },
              },
            });
              
            return NextResponse.json(prismaSearch);
    
        } catch (error) {
            return NextResponse.json({ error: `Failed to fetch tag data for '${tag}': ${error}` }, { status: 500 });
        }
    }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return new NextResponse("Invalid tag name", { status: 400 });
  }

  const existing = await prisma.tagName.findFirst({
    where: { name },
  });
  if (existing) {
    return NextResponse.json({ ok: true, message: "Tag already exists" });
  }

  // Find default category (Uncategorized)
  let defaultCategory = await prisma.tagCategories.findFirst({
    where: { name: "Uncategorized" },
  });

  if (!defaultCategory) {
    defaultCategory = await prisma.tagCategories.create({
      data: {
        name: "Uncategorized",
        color: "#999999",
        order: 999,
      },
    });
  }

  const newTag = await prisma.tags.create({
    data: {
      categoryId: defaultCategory.id,
      names: {
        create: [{ name }],
      },
    },
  });

  return NextResponse.json({ ok: true, created: newTag });
}