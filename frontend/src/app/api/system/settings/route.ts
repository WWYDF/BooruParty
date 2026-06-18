import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/core/prisma";
import { auth } from "@/core/authServer";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { Prisma } from "@prisma/client";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const perms = await checkPermissions(["administrator"]);
  if (!session || !perms["administrator"]) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const data: Prisma.SiteSettingsUpdateInput = {};

  if (typeof body.siteName === "string") data.siteName = body.siteName;
  if (typeof body.accent === "string") data.accent = body.accent;
  if (typeof body.darkerAccent === "string") data.darkerAccent = body.darkerAccent;
  if (typeof body.deletePosts === "boolean") data.deletePosts = body.deletePosts;
  if (typeof body.boostCooldown === "number") data.boostCooldown = body.boostCooldown;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  const updated = await prisma.siteSettings.update({
    where: { id: 1 },
    data,
  });

  return NextResponse.json(updated, { status: 200 });
}
