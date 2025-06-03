"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AddRoleModal from "./AddRoleModal";
import { useToast } from "../Toast";

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
  const [showModal, setShowModal] = useState(false);
  const [roles, setRoles] = useState<Role[]>(
    defaultRole ? [...otherRoles, defaultRole] : [...otherRoles]
  );
  const toast = useToast();

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
    toast('Deleted role!', 'success');
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
      {/* Header with title and button aligned */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">Role Management</h1>
        <button
          onClick={() => setShowModal(true)}
          className="text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
        >
          + Add Role
        </button>
      </div>

      <AnimatePresence>
        {showModal && (
          <AddRoleModal
            allPermissions={allPermissions}
            onCancel={() => setShowModal(false)}
            onCreate={async ({ name, permissionIds }) => {
              const res = await fetch(`/api/roles`, {
                method: "POST",
                body: JSON.stringify({
                  name,
                  permissions: permissionIds.map((id) => ({ id })),
                }),
                headers: { "Content-Type": "application/json" },
              });

              const created = await res.json();
              setRoles((prev) => [...prev, created]);
              setShowModal(false);
              toast('Created role!', 'success');
            }}
          />
        )}
      </AnimatePresence>

      {/* Roles w/ Permissions */}
      {roles.map((role) => (
        <motion.div
          key={`${role.id}-${role.name}`}
          className="bg-zinc-900 p-4 rounded-xl border border-secondary-border"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex justify-between items-start">
            <input
              className="bg-transparent border-b border-zinc-600 text-lg font-medium focus:outline-none"
              defaultValue={role.name}
              onBlur={(e) => updateRole(role.id, { name: e.target.value })}
            />
            <div className="flex flex-row items-center justify-end gap-2">
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
                    toast(`Successfully set default role to ${role.id}!`, 'success');
                  }}
                  className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors text-sm"
                >
                  Set as Default
                </button>
              )}
              <button
                onClick={() => deleteRole(role.id)}
                disabled={isRoleWithDefault(role) && role.isDefault}
                className={`flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm ${
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
                    className={`px-2 py-1 rounded text-sm border border-zinc-800 ${
                      active
                        ? "bg-green-600 text-white hover:bg-green-700 transition"
                        : "border-zinc-600 text-zinc-300 hover:border-zinc-700 transition"
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

                      toast(`Successfully updated user's roles!`, 'success');
                    }}
                    className="px-2 py-1 rounded text-sm border border-zinc-800 bg-zinc-600 text-white hover:bg-red-600 transition"
                  >
                    {user.username}
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}  