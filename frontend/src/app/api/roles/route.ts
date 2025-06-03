import { checkPermissions } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

// Create new role
export async function POST(req: Request) {
  const { name, permissions } = await req.json();

  const hasPerms = (await checkPermissions(['dashboard_roles']))['dashboard_roles'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  if (!name) {
    return NextResponse.json({ error: "Missing name" }, { status: 400 });
  }

  const newRole = await prisma.role.create({
    data: {
      name,
      isDefault: false,
      permissions: permissions?.length
        ? {
            connect: permissions.map((p: { id: number }) => ({ id: p.id })),
          }
        : undefined,
    },
    include: {
      permissions: true,
      users: true,
    },
  });

  return NextResponse.json(newRole);
}