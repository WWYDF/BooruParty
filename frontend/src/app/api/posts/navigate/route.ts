import { NextRequest, NextResponse } from "next/server";
import { buildPostQuery, fetchOrderedPosts } from "@/core/postQuery";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const rawQuery = searchParams.get("query") ?? "";
  const sort = (searchParams.get("sort") ?? "new") as "new" | "old";
  const safetyRaw = searchParams.get("safety") ?? "";
  const safety = safetyRaw ? safetyRaw.split("-") : [];
  const current = Number(searchParams.get("current") ?? "0");

  const query = buildPostQuery({ rawQuery, safety, sort });
  const orderedPosts = await fetchOrderedPosts(query, { id: true }) as { id: number }[];

  const ids = orderedPosts.map((p) => p.id);
  const index = ids.findIndex((id) => id === current);

  let previousPostId = 0;
  let nextPostId = 0;

  if (index !== -1) {
    // flipped here
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
