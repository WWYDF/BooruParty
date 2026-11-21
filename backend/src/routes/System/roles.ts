import { FastifyPluginAsync } from "fastify";
import { Prisma } from "../../../prisma/client";
import { PermissionName, PERMISSIONS } from "@/core/objects/permissions";
import { prisma } from "@/core/plugins/prisma";
import { blockApplications } from "@/core/plugins/auth";
import { loadRolePermissions, requirePermission } from "@/core/utilities/permissionCache";
import { hexColorSchema } from "@/core/objects/fastifySchemas";
import { HttpError } from "@/core/utilities/errors";

const MAX_ROLE_NAME = 32;

// Shared by create + edit so both enforce identical rules
const roleFieldSchemas = {
  name: { type: 'string', minLength: 1, maxLength: MAX_ROLE_NAME },
  color: hexColorSchema,
  permissions: {
    type: 'array',
    uniqueItems: true,
    maxItems: PERMISSIONS.length,
    items: { type: 'string', enum: [...PERMISSIONS] },
  },
} as const;

type RoleFields = { name?: string, color?: string, permissions?: PermissionName[] };

// Trims the name (minLength can't catch "   ") and lowercases the color so they compare cleanly
function cleanFields(body: RoleFields): RoleFields {
  const data: RoleFields = {};
  if (body.name !== undefined) {
    data.name = body.name.trim();
    if (!data.name) throw new HttpError(400, { error: 'Bad Request', hint: 'Role name cannot be blank' });
  }
  if (body.color !== undefined) data.color = body.color.toLowerCase();
  if (body.permissions !== undefined) data.permissions = body.permissions;
  return data;
}

function isDuplicateName(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
}
const DUPLICATE_NAME = { error: 'Conflict', hint: 'A role with that name already exists' };

// Everything the Roles page shows about a role
const roleSelect = {
  id: true,
  name: true,
  color: true,
  index: true,
  isDefault: true,
  permissions: { select: { name: true }, orderBy: { name: 'asc' } },
  _count: { select: { users: true } },
} satisfies Prisma.RoleSelect;

type RoleRow = Prisma.RoleGetPayload<{ select: typeof roleSelect }>;

// [{ name }] -> ['posts.view', ...] and _count -> userCount
function formatRole({ permissions, _count, ...role }: RoleRow) {
  return { ...role, permissions: permissions.map((p) => p.name), userCount: _count.users };
}

const roles: FastifyPluginAsync = async (fastify) => {

  // Literally only admins can access this so we don't have to juggle "can mods edit admins?" problems
  fastify.addHook('onRequest', fastify.authenticate);
  fastify.addHook('onRequest', blockApplications); // NEVER through an API key: a leaked key shouldn't be able to grant itself anything
  fastify.addHook('onRequest', requirePermission('administrator'));

  // Every role, highest first (index 0 = top)
  fastify.get('/', async (req, reply) => {
    const rows = await prisma.role.findMany({
      orderBy: [{ index: 'asc' }, { name: 'asc' }],
      select: roleSelect,
    });
    return reply.send(rows.map(formatRole));
  });

  // Every permission a role can have (from code, so it's always exactly what the server checks)
  fastify.get('/permissions', async (req, reply) => {
    return reply.send([...PERMISSIONS]);
  });

  // Create a role at the bottom of the list
  fastify.post('/', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'color'],
        additionalProperties: false,
        properties: roleFieldSchemas,
      },
    },
  }, async (req, reply) => {
    const data = cleanFields(req.body as RoleFields);

    try {
      const role = await prisma.$transaction(async (tx) => {
        const last = await tx.role.aggregate({ _max: { index: true } });

        return tx.role.create({
          data: {
            name: data.name!,
            color: data.color!,
            index: (last._max.index ?? -1) + 1, // bottom = lowest rank
            permissions: { connect: (data.permissions ?? []).map((name) => ({ name })) },
          },
          select: roleSelect,
        });
      });

      await loadRolePermissions(); // the cache only knows roles that existed when it was last loaded
      return reply.status(201).send(formatRole(role));
    } catch (e) {
      if (isDuplicateName(e)) return reply.status(409).send(DUPLICATE_NAME);
      throw e;
    }
  });

  // Edit a role.
  // Permissions are completely replaced.
  // isDefault can only be turned ON (that moves it off the old default)
  fastify.patch('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
      body: {
        type: 'object',
        additionalProperties: false,
        minProperties: 1,
        properties: {
          ...roleFieldSchemas,
          isDefault: { type: 'boolean', const: true },
        },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as RoleFields & { isDefault?: true };
    const data = cleanFields(body);

    try {
      const role = await prisma.$transaction(async (tx) => {
        // Lock EVERY role row: Edits queue up one at a time, so two admins can't each
        // strip 'administrator' from a different role and both pass the check below
        await tx.$queryRaw`SELECT id FROM "Role" FOR UPDATE`;

        const exists = await tx.role.findUnique({ where: { id }, select: { id: true } });
        if (!exists) throw new HttpError(404, { error: 'Not found', hint: 'No role with that id' });

        // Exactly one default: clear the old one first
        if (body.isDefault) {
          await tx.role.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
        }

        await tx.role.update({
          where: { id },
          data: {
            name: data.name,
            color: data.color,
            ...(body.isDefault && { isDefault: true }),
            ...(data.permissions && { permissions: { set: data.permissions.map((name) => ({ name })) } }),
          },
        });

        // Softlock guard: Someone must still be able to get back in here. Throwing rolls everything back.
        if (data.permissions) {
          const admins = await tx.user.count({
            where: { role: { permissions: { some: { name: 'administrator' } } } },
          });
          if (admins === 0) {
            throw new HttpError(409, { error: 'Conflict', hint: 'This would leave nobody with the administrator permission' });
          }
        }

        return tx.role.findUniqueOrThrow({ where: { id }, select: roleSelect });
      });

      if (data.permissions) await loadRolePermissions();
      return reply.send(formatRole(role));
    } catch (e) {
      if (isDuplicateName(e)) return reply.status(409).send(DUPLICATE_NAME);
      throw e;
    }
  });

  // Re-place every role's index. Must provide all role ids.
  fastify.put('/reorder', {
    schema: {
      body: {
        type: 'object',
        required: ['ids'],
        additionalProperties: false,
        properties: {
          ids: { type: 'array', minItems: 1, maxItems: 200, uniqueItems: true, items: { type: 'string', format: 'uuid' } },
        },
      },
    },
  }, async (req, reply) => {
    const { ids } = req.body as { ids: string[] };

    const rows = await prisma.$transaction(async (tx) => {
      // Same lock as PATCH, so a reorder and an edit/create can't interleave
      await tx.$queryRaw`SELECT id FROM "Role" FOR UPDATE`;

      // Must be exactly the current set of roles: nothing missing, nothing extra
      const existing = await tx.role.findMany({ select: { id: true } });
      const known = new Set(existing.map((r) => r.id));
      if (ids.length !== known.size || ids.some((id) => !known.has(id))) {
        throw new HttpError(409, { error: 'Conflict', hint: 'The roles changed since this list was loaded' });
      }

      for (const [index, id] of ids.entries()) {
        await tx.role.update({ where: { id }, data: { index } });
      }

      return tx.role.findMany({ orderBy: [{ index: 'asc' }, { name: 'asc' }], select: roleSelect });
    });

    return reply.send(rows.map(formatRole));
  });

  // Delete a role. Its users move to the default role (which itself can't be deleted)
  fastify.delete('/:id', {
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string', format: 'uuid' } },
      },
    },
  }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const result = await prisma.$transaction(async (tx) => {
      // Same lock as edit/reorder: role changes happen one at a time
      await tx.$queryRaw`SELECT id FROM "Role" FOR UPDATE`;

      const role = await tx.role.findUnique({ where: { id }, select: { name: true, isDefault: true } });
      if (!role) throw new HttpError(404, { error: 'Not found', hint: 'No role with that id' });
      if (role.isDefault) {
        throw new HttpError(409, { error: 'Conflict', hint: 'The default role can\'t be deleted. Make another role the default first' });
      }

      const fallback = await tx.role.findFirst({ where: { isDefault: true }, select: { id: true, name: true } });
      if (!fallback) throw new HttpError(409, { error: 'Conflict', hint: 'There is no default role to move its users to' });

      // Users first: User.roleId is required (and Restrict), so the delete would fail otherwise
      const { count: movedUsers } = await tx.user.updateMany({ where: { roleId: id }, data: { roleId: fallback.id } });
      await tx.role.delete({ where: { id } }); // its permission links go with it (implicit m2m)

      // Softlock guard, same as PATCH: Someone must still be an administrator afterwards
      const admins = await tx.user.count({
        where: { role: { permissions: { some: { name: 'administrator' } } } },
      });
      if (admins === 0) {
        throw new HttpError(409, { error: 'Conflict', hint: 'This would leave nobody with the administrator permission' });
      }

      return { movedUsers, movedTo: fallback.name };
    });

    await loadRolePermissions();
    return reply.send(result);
  });
};

export default roles;
