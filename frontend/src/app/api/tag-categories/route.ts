// /app/api/tag-categories/route.ts
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const categories = await prisma.tagCategories.findMany({
    orderBy: { order: "asc" },
  });
  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const body = await req.json();
  const { name, color, order } = body;

  const category = await prisma.tagCategories.create({
    data: { name, color, order },
  });

  return NextResponse.json(category);
}
