import { auth } from "@/core/authServer";
import { prisma } from "@/core/prisma";

type RoleDominanceOptions = {
  targetIndex?: number; // optional override to avoid a role lookup, accepted for backward compatibility
  roleList?: Response;
};

export async function checkPermissions(
  perms: string | string[]
): Promise<Record<string, boolean>> {
  const permissions = Array.isArray(perms) ? perms : [perms];

  // Allow all to view posts if permission is post_view and GUEST_VIEWING is enabled
  if ( permissions.includes("post_view") && process.env.GUEST_VIEWING === "true" ) {
    return Object.fromEntries(permissions.map((p) => [p, true]));
  }

  const session = await auth();
  const userPerms = session?.user.permissions ?? [];
  const hasAdmin = userPerms.includes("administrator");

  return Object.fromEntries(
    permissions.map((p) => [p, hasAdmin || userPerms.includes(p)])
  );
}

export async function checkRoleDominance(
  targetRoleId: number,
  options?: RoleDominanceOptions
): Promise<boolean> {
  const session = await auth();
  const actorIndex = session?.user.roleIndex;
  if (typeof actorIndex !== "number") return false;

  // Use override index if provided
  if (typeof options?.targetIndex === "number") {
    return actorIndex < options.targetIndex;
  }

  // Otherwise, resolve index from roleId
  const target = await prisma.role.findUnique({
    where: { id: targetRoleId },
    select: { index: true },
  });
  if (!target) return false;

  // Lower index means more power
  return actorIndex <= target.index;
}