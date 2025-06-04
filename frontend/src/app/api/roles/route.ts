import { checkPermissions } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

// Create new role
export async function POST(req: Request) {
  const { name, permissions, color } = await req.json();

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
      color
    },
    include: {
      permissions: true,
      users: true,
    },
  });

  return NextResponse.json(newRole);
}

// List roles
export async function GET() {
  try {
    const roles = await prisma.role.findMany({
      orderBy: { index: 'asc' },
      include: {
        permissions: { select: { name: true } }
      }
    })

    return NextResponse.json(roles, { status: 200 });
  } catch (err) {
    console.error("GET /api/system/roles error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
