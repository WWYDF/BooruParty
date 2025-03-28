import { prisma } from "@/core/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search")?.toLowerCase();
  if (!search) {
    return NextResponse.json({ error: "Missing search parameter" }, { status: 400 });
  }

  try {
    const matchingTagNames = await prisma.tagName.findMany({
      where: {
        name: search,
      },
      include: {
        tag: {
          include: {
            category: true,
          },
        },
      },
    });

    if (!matchingTagNames.length) {
      return NextResponse.json({ results: [] });
    }

    // Return the full Tags object including category via TagName
    const results = matchingTagNames.map((tagName) => ({
      name: tagName.name,
      tagId: tagName.tagId,
      category: tagName.tag.category,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Failed to search tags:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
