import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { checkPermissions } from "@/components/serverSide/permCheck";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const hasPerms = (await checkPermissions(['dashboard_audit_log']))['dashboard_audit_log'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to view the contents of this page." }, { status: 403 }); }

  const page = parseInt(searchParams.get("page") || "1");
  const perPage = 20;
  const skip = (page - 1) * perPage;

  const category = searchParams.get("category") || undefined;
  const actionType = searchParams.get("actionType") || undefined;
  const username = searchParams.get("username") || undefined;

  const where: any = {};

  if (category) where.category = category;
  if (actionType) where.actionType = actionType;
  if (username) {
    where.user = {
      username: {
        contains: username,
        mode: "insensitive",
      },
    };
  }

  const [logs, total] = await Promise.all([
    prisma.audits.findMany({
      where,
      orderBy: { executedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            avatar: true,
            role: true,
          },
        },
      },
      skip,
      take: perPage,
    }),
    prisma.audits.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  });
}
