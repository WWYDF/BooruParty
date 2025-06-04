import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

// Fetch all tag categories.
// Add `default=true` to make the default category first in the return.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const showDefaultFirst = searchParams.get("default") === "true";

  const orderBy = showDefaultFirst
    ? [{ isDefault: "desc" }, { order: "asc" }]
    : [{ order: "asc" }];

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

export async function PATCH(req: Request) {
  const session = await auth();

  const hasPerms = (await checkPermissions(['tags_categories_manage']))['tags_categories_manage'];
  if (!session || !hasPerms) {
    return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 });
  }

  const body = await req.json();
  const { orders } = body;

  if (!Array.isArray(orders)) {
    return NextResponse.json({ error: 'Missing or invalid "orders" array' }, { status: 400 });
  }

  const validOrders = orders.every(
    (entry: any) => typeof entry.id === 'number' && typeof entry.order === 'number'
  );
  if (!validOrders) {
    return NextResponse.json({ error: 'Each order must include numeric "id" and "order"' }, { status: 400 });
  }

  const ids = orders.map((entry: any) => entry.id);

  const originalCategories = await prisma.tagCategories.findMany({
    where: { id: { in: ids } },
    select: { id: true, order: true, name: true },
  });

  // Prepare audit diff
  const diffs: string[] = [];
  for (const { id, order } of orders) {
    const original = originalCategories.find((cat) => cat.id === id);
    if (original && original.order !== order) {
      diffs.push(`- '${original.name}': ${original.order} → ${order}`);
    }
  }

  try {
    await prisma.$transaction(
      orders.map(({ id, order }: { id: number; order: number }) =>
        prisma.tagCategories.update({
          where: { id },
          data: { order },
        })
      )
    );

    if (diffs.length > 0) {
      const forwarded = req.headers.get("x-forwarded-for");
      const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;

      const changeDetails = `Updated Tag Category Order\nChanges:\n${diffs.join('\n')}`;
      await reportAudit(session.user.id, 'EDIT', 'CATEGORY', ip, changeDetails);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[PATCH /api/tag-categories]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}