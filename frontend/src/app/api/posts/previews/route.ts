import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");

  if (!idsParam) {
    return NextResponse.json({ error: "Missing 'ids' parameter" }, { status: 400 });
  }

  const ids = idsParam
    .split(",")
    .map((id) => parseInt(id.trim()))
    .filter((id) => !isNaN(id));

  if (ids.length === 0) {
    return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });
  }

  const posts = await prisma.posts.findMany({
    where: {
      id: { in: ids },
    },
    select: {
      id: true,
      previewPath: true,
    },
  });

  const transformed = posts.map((post) => ({
    id: post.id,
    previewPath: post.previewPath
      ? `${process.env.NEXT_PUBLIC_FASTIFY}${post.previewPath}`
      : null,
  }));

  return NextResponse.json(transformed);
}
