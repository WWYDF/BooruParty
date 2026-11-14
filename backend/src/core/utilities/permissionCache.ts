import { FastifyReply, FastifyRequest } from "fastify";
import { PermissionName } from "../objects/permissions";
import { appLogger } from "../plugins/logger";
import { prisma } from "../plugins/prisma";

const logger = appLogger('Permissions');

// roleId -> that role's permission names
let rolePermissions = new Map<string, Set<PermissionName>>();

// Reads every role and its permissions from the DB into memory.
// Call once at startup, and again whenever a role's permissions are edited.
export async function loadRolePermissions() {
  const roles = await prisma.role.findMany({
    include: { permissions: { select: { name: true } } },
  });

  const next = new Map<string, Set<PermissionName>>();
  for (const role of roles) {
    const names = role.permissions.map((p) => p.name as PermissionName);
    next.set(role.id, new Set(names));
  }

  rolePermissions = next;
  logger.info(`[+] Refreshed permissions for ${roles.length} roles.`);
}

// Does this role have this permission?
export function rolePermissionCheck(roleId: string, permission: PermissionName): boolean {
  const perms = rolePermissions.get(roleId);
  if (!perms) return false; // unknown role (deleted?) gets nothing
  return perms.has('administrator') || perms.has(permission); // 'administrator' force grants everything.
}

// Route hook. Must run AFTER fastify.authenticate (which sets req.user).
// Usage: { onRequest: [fastify.authenticate, requirePermission('posts.delete.others')] }
export function requirePermission(permission: PermissionName) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.user) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    if (!rolePermissionCheck(req.user.roleId, permission)) {
      return reply.status(403).send({ error: 'Forbidden', hint: `Missing permission: ${permission}` });
    }
  }
}