"use client";

import { useState } from "react";
import { motion } from "framer-motion";

// Types
type RoleWithUsers = {
  id: number;
  name: string;
  permissions: { id: number; name: string }[];
  users: { id: string; username: string }[];
};

type RoleWithoutUsers = {
  id: number;
  name: string;
  permissions: { id: number; name: string }[];
};

type Role = RoleWithUsers | RoleWithoutUsers;

type Props = {
  defaultRole: RoleWithoutUsers | null;
  otherRoles: RoleWithUsers[];
  allPermissions: { id: number; name: string }[];
  allUsers: { id: string; username: string }[];
};

export default function RoleEditor({ defaultRole, otherRoles, allPermissions }: Props) {
  const [roles, setRoles] = useState<Role[]>(
    defaultRole ? [...otherRoles, defaultRole] : [...otherRoles]
  );

  const isRoleWithDefault = (role: any): role is RoleWithUsers & { isDefault: boolean } =>
    typeof role === "object" && "isDefault" in role && typeof role.isDefault === "boolean";

  const isRoleWithUsers = (role: Role): role is RoleWithUsers => {
    return "users" in role;
  };

  const updateRole = async (id: number, updates: Partial<RoleWithUsers>) => {
    const res = await fetch(`/api/roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
      headers: { "Content-Type": "application/json" },
    });
    if (res.ok) {
      const updated = await res.json();
      setRoles((prev) => prev.map((r) => (r.id === id ? updated : r)));
    }
  };

  const deleteRole = async (id: number) => {
    await fetch(`/api/roles/${id}`, { method: "DELETE" });
    setRoles((prev) => prev.filter((r) => r.id !== id));
  };

  const createRole = async () => {
    const res = await fetch(`/api/roles`, {
      method: "POST",
      body: JSON.stringify({ name: "New Role" }),
      headers: { "Content-Type": "application/json" },
    });
    const newRole = await res.json();
    setRoles((prev) => [...prev, newRole]);
  };

  const togglePermission = (role: Role, permId: number) => {
    const has = role.permissions.some((p) => p.id === permId);
    updateRole(role.id, {
      permissions: has
        ? role.permissions.filter((p) => p.id !== permId)
        : [...role.permissions, allPermissions.find((p) => p.id === permId)!],
    });
  };

  return (
    <div className="space-y-6">
      {roles.map((role) => (
        <motion.div
          key={`${role.id}-${role.name}`}
          className="bg-zinc-800 p-4 rounded-xl border border-zinc-700"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-start">
            <input
              className="bg-transparent border-b border-zinc-600 text-lg font-medium"
              defaultValue={role.name}
              onBlur={(e) => updateRole(role.id, { name: e.target.value })}
            />
            <div className="flex flex-col items-end gap-1">
              {isRoleWithDefault(role) && !role.isDefault && (
                <button
                  onClick={async () => {
                    await fetch(`/api/roles/${role.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ isDefault: true }),
                    });
  
                    setRoles(prev =>
                      prev.map(r => ({
                        ...r,
                        isDefault: r.id === role.id,
                      }))
                    );
                  }}
                  className="text-yellow-400 hover:underline"
                >
                  Set as Default
                </button>
              )}
              <button
                onClick={() => deleteRole(role.id)}
                disabled={isRoleWithDefault(role) && role.isDefault}
                className={`text-red-400 hover:underline ${
                  "isDefault" in role && role.isDefault
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }`}
              >
                Delete
              </button>
            </div>
          </div>
  
          <div className="mt-4">
            <p className="text-sm text-zinc-400">Permissions</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {allPermissions.map((perm) => {
                const active = role.permissions.some((p) => p.id === perm.id);
                return (
                  <button
                    key={`${role.id}-${perm.id}`}
                    onClick={() => togglePermission(role, perm.id)}
                    className={`px-2 py-1 rounded text-sm border ${
                      active
                        ? "bg-green-600 text-white"
                        : "border-zinc-600 text-zinc-300 hover:border-white"
                    }`}
                  >
                    {perm.name}
                  </button>
                );
              })}
            </div>
          </div>
  
          {isRoleWithUsers(role) && (
            <div className="mt-4">
              <p className="text-sm text-zinc-400">Users in this role</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {role.users.map((user) => (
                  <button
                    key={user.id}
                    onClick={async () => {
                      await fetch(`/api/users/${user.username}/role`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ roleId: roles.find(r => "isDefault" in r && r.isDefault)?.id }),
                      });
  
                      setRoles((prev) =>
                        prev.map((r) =>
                          r.id === role.id && isRoleWithUsers(r)
                            ? { ...r, users: r.users.filter((u) => u.id !== user.id) }
                            : r
                        )
                      );
                    }}
                    className="px-2 py-1 rounded text-sm border bg-blue-600 text-white hover:bg-red-600 transition"
                  >
                    {user.username}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ))}
  
      <button
        onClick={createRole}
        className="text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded"
      >
        + Add Role
      </button>
    </div>
  );
}  