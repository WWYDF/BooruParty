import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";
import consola from "consola";

const prisma = new PrismaClient()
export const logger = consola.withTag('API')

const querySchema = z.object({
  search: z.string().optional(),
  safety: z.string().optional(),
  tags: z.string().optional(),
  sort: z.enum(["new", "old"]).optional(),
  page: z.coerce.number().default(1),
  perPage: z.coerce.number().default(50),
});

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const query = querySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const { search, safety, tags, sort = "new", page, perPage } = query;

    const whereClause: any = {};

    if (search) {
      whereClause.OR = [
        { fileName: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { tags: { hasSome: [search.toLowerCase()] } },
      ];
    }

    if (safety) {
      whereClause.safety = safety;
    }

    if (tags) {
      const tagArray = tags.split(",").map((t) => t.trim().toLowerCase());
      whereClause.tags = { hasEvery: tagArray };
    }

    const posts = await prisma.posts.findMany({
      where: whereClause,
      orderBy: {
        createdAt: sort === "old" ? "asc" : "desc",
      },
      skip: (page - 1) * perPage,
      take: perPage,
    });

    return NextResponse.json(posts);
  } catch (error) {
    logger.error("[GET /api/posts]", error);
    return NextResponse.json({ error: "Failed to fetch posts." }, { status: 500 });
  }
}
