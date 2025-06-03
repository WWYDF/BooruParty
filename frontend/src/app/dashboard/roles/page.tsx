import RoleEditor from "@/components/clientSide/Dashboard/RoleEditor";
import { prisma } from "@/core/prisma";

export default async function RolesDashboardPage() {
  const defaultRole = await prisma.role.findFirst({
    where: { isDefault: true },
    include: { permissions: true }
  });

  const otherRoles = await prisma.role.findMany({
    where: {
      isDefault: false
    },
    include: {
      permissions: true,
      users: {
        select: { id: true, username: true },
      },
    },
    orderBy: { id: 'asc' }
  });

  const permissions = await prisma.permission.findMany();
  const users = await prisma.user.findMany({ select: { id: true, username: true } });

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">Role Management</h1>
      <RoleEditor
        defaultRole={defaultRole}
        otherRoles={otherRoles}
        allPermissions={permissions}
        allUsers={users}
      />
    </div>
  );
}
