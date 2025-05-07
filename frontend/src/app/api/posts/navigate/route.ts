import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { buildPostWhereAndOrder } from "@/components/serverSide/Posts/filters";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const rawQuery = searchParams.get("query") ?? "";
  const sort = (searchParams.get("sort") ?? "new") as "new" | "old";
  const safety = searchParams.get("safety") ?? "";
  const current = Number(searchParams.get("current") ?? "0");

  const { where, orderBy } = buildPostWhereAndOrder(rawQuery, safety, sort);

  const orderedPosts = await prisma.posts.findMany({
    where,
    select: { id: true },
    orderBy,
  });

  const ids = orderedPosts.map((p) => p.id);
  const index = ids.findIndex((id) => id === current);

  let previousPostId = 0;
  let nextPostId = 0;

  if (index !== -1) {
    // ⬅️ flipped here
    nextPostId = index > 0 ? ids[index - 1] : 0;
    previousPostId = index < ids.length - 1 ? ids[index + 1] : 0;
  } else {
    // fallback if current is not in the list
    nextPostId = ids.at(-1) ?? 0;
    previousPostId = ids.at(0) ?? 0;
  }

  return NextResponse.json({
    previousPostId,
    nextPostId,
  });
}
