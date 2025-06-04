import { reportAudit } from "@/components/serverSide/auditLog";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";
import { NextResponse } from "next/server";

// Edit a role
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const prams = await params;
  const roleId = Number(prams.id);
  const { name, permissions, isDefault, index } = await req.json();
  const session = await auth();
  console.log(`${name}, ${permissions}, ${isDefault}, ${index}`);

  const hasPerms = (await checkPermissions(['dashboard_roles']))['dashboard_roles'];
  if (!hasPerms || !session) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

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


  const original = await prisma.role.findUnique({
    where: { id: roleId },
    include: { permissions: { select: { id: true, name: true } } },
  });

  if (!original) { return NextResponse.json({ error: "Role not found" }, { status: 404 }); }

  const beforePerms = original?.permissions ?? [];
  const afterPerms = permissions ?? [];
  
  const beforeIds = new Set(beforePerms.map(p => p.id));
  const afterIds = new Set(afterPerms.map((p: any) => p.id));
  
  const added = afterPerms
    .filter((p: any) => !beforeIds.has(p.id))
    .map((p: any) => p.name);
  
  const removed = beforePerms
    .filter(p => !afterIds.has(p.id))
    .map(p => p.name);


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

  const changeLines = [];

  // Name change
  if (name !== undefined && original.name !== name) {
    changeLines.push(`- Renamed: "${original.name}" → "${name}"`);
  }
  
  // Index change
  if (index !== undefined && original.index !== index) {
    changeLines.push(`- Index changed: ${original.index} → ${index}`);
  }
  
  // isDefault change
  if (isDefault !== undefined && original.isDefault !== isDefault) {
    changeLines.push(`- isDefault: ${original.isDefault} → ${isDefault}`);
  }

  // Permissions change (only if explicitly updated)
  if (permissions !== undefined && (added.length || removed.length)) {
    if (added.length) changeLines.push(`- Added: ${added.join(", ")}`);
    if (removed.length) changeLines.push(`Removed: ${removed.join(", ")}`);
  }

  if (changeLines.length > 0) {
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  
    const changeDetails = `Updated Role '${original.name}'\nChanges:\n${changeLines.join("\n")}`;
    await reportAudit(session.user.id, 'EDIT', 'ROLE', ip, changeDetails);
  }

  return NextResponse.json(full);
}

// Remove a role
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const prams = await params;
  const roleId = Number(prams.id);
  const session = await auth();

  const hasPerms = (await checkPermissions(['dashboard_roles']))['dashboard_roles'];
  if (!hasPerms || !session) { return NextResponse.json({ error: "You are unauthorized to use this endpoint." }, { status: 403 }); }

  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: {
      isDefault: true,
      name: true,
      _count: {
        select: {
          users: true
        }
      }
    },
  });

  if (!role) { return NextResponse.json({ error: "The specified role could not be found." }, { status: 404 }); }

  if (role.isDefault) {
    return NextResponse.json(
      { error: "Cannot delete the default role. Please set another role as default first." },
      { status: 400 }
    );
  }

  const defaultRole = await prisma.role.findFirst({
    where: { isDefault: true },
    select: { id: true, name: true },
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

  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || undefined;
  await reportAudit(session.user.id, 'DELETE', 'ROLE', ip, `Changes:\n- Role: ${role.name}\n- ${role._count.users} Members have been moved to ${defaultRole.name}.`);

  return NextResponse.json({ ok: true });
}