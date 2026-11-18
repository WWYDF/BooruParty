import { Prisma } from "../../../prisma/client";
import { visibleConditions } from "@/components/posts/postQuery";
import { rolePermissionCheck } from "@/core/utilities/permissionCache";
import { Viewer } from "@/core/utilities/viewer";

export function canManagePools(viewer: Viewer): boolean {
  return viewer.roleId !== null && rolePermissionCheck(viewer.roleId, 'pool.manage');
}

// A pool with nothing visible looks like it doesn't exist (managers see every pool)
export function visiblePoolConditions(viewer: Viewer): Prisma.PoolWhereInput {
  return canManagePools(viewer) ? {} : { items: { some: { post: { AND: visibleConditions(viewer) } } } };
}
