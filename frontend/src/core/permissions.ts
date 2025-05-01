import { prisma } from "@/core/prisma";

export async function hasPermission(userId: string, permission: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: true
        }
      }
    }
  });

  return user?.role?.permissions.some(p => p.name === permission) ?? false;
}