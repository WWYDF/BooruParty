import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ignoreDefault = searchParams.get("ignoreDefault") === "true";

  const orderBy = ignoreDefault
    ? [{ order: "asc" }]
    : [{ isDefault: "desc" }, { order: "asc" }];

  const categories = await prisma.tagCategories.findMany({
    orderBy: orderBy as { order?: "asc" | "desc"; isDefault?: "asc" | "desc" }[],
  });

  return NextResponse.json(categories);
}

export async function POST(req: Request) {
  const body = await req.json();
  let { name, color, order } = body;
  const session = await auth();

  const hasPerms = (await checkPermissions(['tags_categories_manage']))['tags_categories_manage'];
  if (!session || !hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  if (!color) color = '#3c9aff';
  order - parseInt(order);

  const category = await prisma.tagCategories.create({
    data: { name, color, order },
  });

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  await reportAudit(session.user.id, 'CREATE', 'CATEGORY', ip, `Tag Category Name: ${name}`);

  return NextResponse.json(category);
}
