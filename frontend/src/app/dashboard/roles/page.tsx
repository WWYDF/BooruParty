import RoleEditor from "@/components/clientSide/Dashboard/RoleEditor";
import { checkPermissions } from "@/components/serverSide/permCheck";
import { prisma } from "@/core/prisma";

export default async function RolesDashboardPage() {
  const hasPerms = (await checkPermissions(['dashboard_roles']))['dashboard_roles'];

  if (!hasPerms) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center text-center px-4 text-red-400">
        <h1 className="text-3xl font-bold mb-2">Access Denied</h1>
        <p className="text-base text-subtle max-w-md">You lack the proper permissions to view this page.</p>
      </main>
    );
  }

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
    orderBy: [
      { index: 'asc' },
      { id: 'asc' }
    ]
  });

  const permissions = await prisma.permission.findMany();
  const users = await prisma.user.findMany({ select: { id: true, username: true } });

  return (
    <div className="mx-auto p-6">
      <RoleEditor
        defaultRole={defaultRole}
        otherRoles={otherRoles}
        allPermissions={permissions}
        allUsers={users}
      />
    </div>
  );
}
