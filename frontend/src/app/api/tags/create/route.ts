import { NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { reportAudit } from "@/components/serverSide/auditLog";
import { auth } from "@/core/auth";

export async function POST(req: Request) {
  const { name, categoryId } = await req.json();
  const session = await auth();

  const hasPerms = (await checkPermissions(['tags_create']))['tags_create'];
  if (!session || !hasPerms) { return NextResponse.json({ error: "You are unauthorized to create tags." }, { status: 403 }); }

  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  try {
    const existing = await prisma.tags.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json({ error: "Tag already exists." }, { status: 400 });
    }

    await prisma.tags.create({
      data: {
        name,
        categoryId: categoryId || null,
      },
    });

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
    await reportAudit(session.user.id, 'CREATE', 'TAG', `Tag Name: ${name}, Category: ${categoryId}`);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[TAG_CREATE]", err);
    return NextResponse.json({ error: "Failed to create tag." }, { status: 500 });
  }
}