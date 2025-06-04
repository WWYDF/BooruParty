import { checkPermissions } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

// Edit a role
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const prams = await params;
  const roleId = Number(prams.id);
  const { name, permissions, users, isDefault, index } = await req.json();

  const hasPerms = (await checkPermissions(['dashboard_roles']))['dashboard_roles'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  if (isDefault === false) {
    const current = await prisma.role.findUnique({
      where: { id: roleId },
      select: { isDefault: true },
    });

    if (current?.isDefault) {
      return NextResponse.json(
        { error: "You cannot unset the default role. Set another role as default instead." },
        { status: 400 }
      );
    }
  }

  if (isDefault) {
    await prisma.role.updateMany({
      where: { isDefault: true, id: { not: roleId } },
      data: { isDefault: false },
    });
  }

  // Update the role
  await prisma.role.update({
    where: { id: roleId },
    data: {
      name,
      isDefault,
      permissions: permissions
        ? { set: permissions.map((p: any) => ({ id: p.id })) }
        : undefined,
      users: users
        ? { set: users.map((u: any) => ({ id: u.id })) }
        : undefined,
      index
    },
  });

  // Fetch updated role
  const updated = await prisma.role.findUnique({
    where: { id: roleId },
    include: {
      permissions: true,
      users: false, // will be overwritten below if needed
    },
  });

  // If NOT default, fetch users too
  const full = updated?.isDefault
    ? updated
    : await prisma.role.findUnique({
        where: { id: roleId },
        include: {
          permissions: true,
          users: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      });

  return NextResponse.json(full);
}

// Remove a role
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const prams = await params;
  const roleId = Number(prams.id);

  const hasPerms = (await checkPermissions(['dashboard_roles']))['dashboard_roles'];
  if (!hasPerms) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { isDefault: true },
  });

  if (role?.isDefault) {
    return NextResponse.json(
      { error: "Cannot delete the default role. Please set another role as default first." },
      { status: 400 }
    );
  }

  const defaultRole = await prisma.role.findFirst({
    where: { isDefault: true },
    select: { id: true },
  });

  if (!defaultRole) {
    return NextResponse.json({ error: "No default role found" }, { status: 500 });
  }

  await prisma.user.updateMany({
    where: { roleId },
    data: { roleId: defaultRole.id },
  });

  await prisma.role.delete({
    where: { id: roleId },
  });

  return NextResponse.json({ ok: true });
}