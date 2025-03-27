import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const body = await req.json();
  const { name, color, order } = body;

  const updated = await prisma.tagCategories.update({
    where: { id: parseInt(id) },
    data: { name, color, order },
  });

  return NextResponse.json(updated);
}
