import { auth } from "@/core/auth";
import { prisma } from "@/core/prisma";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "50");
  const search = searchParams.get("search") || "";

  const where = search
  ? {
      OR: [
        { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
        { aliases: { some: { alias: { contains: search, mode: Prisma.QueryMode.insensitive } } } },
      ],
    }
  : {};

  const tags = await prisma.tags.findMany({
    where,
    skip: (page - 1) * perPage,
    take: perPage,
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      aliases: { select: { alias: true } },
      implications: { select: { name: true } },
      suggestions: { select: { name: true } },
      posts: { select: { id: true } },
      createdAt: true,
    },
  });

  const totalCount = await prisma.tags.count({ where });
  const totalPages = Math.ceil(totalCount / perPage);

  return NextResponse.json({
    tags,
    totalPages,
  });
}