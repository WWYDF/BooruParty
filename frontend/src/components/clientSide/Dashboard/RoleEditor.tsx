"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import AddRoleModal from "./AddRoleModal";
import { useToast } from "../Toast";
import ConfirmModal from "../ConfirmModal";
import RoleReorderer from "./RoleReorder";
import { useRouter } from "next/navigation";

// Types
type RoleWithUsers = {
  id: number;
  name: string;
  color: string | null;
  permissions: { id: number; name: string }[];
  users: { id: string; username: string }[];
};

type RoleWithoutUsers = {
  id: number;
  name: string;
  color: string | null;
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
  const [reordering, setReordering] = useState(false);
  const [roles, setRoles] = useState<Role[]>(
    defaultRole ? [...otherRoles, defaultRole] : [...otherRoles]
  );
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: number | null }>({
    open: false,
    id: null,
  });
  const toast = useToast();
  const router = useRouter();

  const isRoleWithDefault = (
    role: any
  ): role is RoleWithUsers & { isDefault: boolean } =>
    typeof role === "object" &&
    "isDefault" in role &&
    typeof role.isDefault === "boolean";

  const isRoleWithUsers = (role: Role): role is RoleWithUsers => "users" in role;

  const safeColor = (clr: string | null | undefined) =>
    clr && /^#([0-9a-f]{3}){1,2}$/i.test(clr) ? clr : "#ffffff";

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
    toast("Deleted role!", "success");
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold text-white">Role Management</h1>
        <div className="flex gap-2">
          {!reordering && (
            <>
              <button
                onClick={() => {
                  setShowModal(false);
                  setReordering(true);
                }}
                className="text-sm text-white bg-zinc-700 hover:bg-zinc-800 px-4 py-2 rounded-lg"
              >
                Reorder
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg"
              >
                + Add Role
              </button>
            </>
          )}
        </div>
      </div>

      {/* Reordering Mode */}
      {reordering ? (
        <RoleReorderer
          roles={roles as any}
          onCancel={() => setReordering(false)}
          onSave={async (updated) => {
            await Promise.all(
              updated.map((role, idx) =>
                fetch(`/api/roles/${role.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ index: idx }),
                })
              )
            );
            setRoles(updated);
            toast("Saved new role order", "success");
            setReordering(false);
          }}
        />
      ) : (
        <>
          {/* AddRoleModal */}
          <AnimatePresence>
            {showModal && (
              <AddRoleModal
                allPermissions={allPermissions}
                onCancel={() => setShowModal(false)}
                onCreate={async ({ name, permissionIds, color }) => {
                  const res = await fetch(`/api/roles`, {
                    method: "POST",
                    body: JSON.stringify({
                      name,
                      color,
                      permissions: permissionIds.map((id: number) => ({ id })),
                    }),
                    headers: { "Content-Type": "application/json" },
                  });

                  const created = await res.json();
                  setRoles((prev) => [...prev, created]);
                  setShowModal(false);
                  toast("Created role!", "success");
                }}
              />
            )}
          </AnimatePresence>

          {/* Confirm Delete Modal */}
          <ConfirmModal
            open={confirmDelete.open}
            onClose={() => setConfirmDelete({ open: false, id: null })}
            onConfirm={async () => {
              if (confirmDelete.id !== null) {
                await deleteRole(confirmDelete.id);
                setConfirmDelete({ open: false, id: null });
              }
            }}
            title="Delete this role?"
            description={`This action will permanently delete the role. Members of this role will be moved to the default role.\n\nAre you sure you want to proceed?`}
            confirmText="Delete"
            cancelText="Cancel"
            maxWidth="max-w-xl"
          />

          {/* Existing Roles */}
          {roles.map((role) => (
            <motion.div
              key={`${role.id}-${role.name}`}
              className="bg-zinc-900 p-4 rounded-xl border border-secondary-border"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {/* Header row */}
              <div className="flex justify-between items-start">
                {/* Name + color */}
                <div className="flex items-center gap-3">
                  {/* Color picker */}
                  <label className="relative cursor-pointer">
                    <input
                      type="color"
                      value={safeColor(role.color)}
                      onChange={(e) => updateRole(role.id, { color: e.target.value })}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <span
                      className="block w-6 h-6 rounded-full border border-zinc-600"
                      style={{ backgroundColor: safeColor(role.color) }}
                    ></span>
                  </label>

                  {/* Name editable */}
                  <input
                    className="bg-transparent border-b border-zinc-600 text-lg font-medium focus:outline-none"
                    defaultValue={role.name}
                    onBlur={(e) => updateRole(role.id, { name: e.target.value })}
                  />
                </div>

                {/* Action buttons */}
                <div className="flex flex-row items-center justify-end gap-2">
                  {isRoleWithDefault(role) && !role.isDefault && (
                    <button
                      onClick={async () => {
                        await fetch(`/api/roles/${role.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ isDefault: true }),
                        });
                        setRoles((prev) =>
                          prev.map((r) => ({ ...r, isDefault: r.id === role.id }))
                        );
                        toast(`Set ${role.name} as default role!`, "success");
                      }}
                      className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors text-sm"
                    >
                      Set as Default
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmDelete({ open: true, id: role.id })}
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

              {/* Permissions */}
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

              {/* Users list (for non‑default roles) */}
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
                            body: JSON.stringify({
                              roleId: roles.find((r) => "isDefault" in r && r.isDefault)?.id,
                            }),
                          });
                          setRoles((prev) =>
                            prev.map((r) =>
                              r.id === role.id && isRoleWithUsers(r)
                                ? { ...r, users: r.users.filter((u) => u.id !== user.id) }
                                : r
                            )
                          );
                          toast("Updated user's roles!", "success");
                        }}
                        className="px-2 py-1 rounded text-sm border border-zinc-800 bg-zinc-600 text-white hover:bg-red-600 transition"
                        title="Remove user from this role"
                      >
                        {user.username}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </>
      )}
    </div>
  );
}
