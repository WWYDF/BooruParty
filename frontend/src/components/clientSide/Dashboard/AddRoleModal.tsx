"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Permission = {
  id: number;
  name: string;
};

type Props = {
  allPermissions: Permission[];
  onCreate: (data: { name: string; permissionIds: number[], color: string }) => void;
  onCancel: () => void;
};

export default function AddRoleModal({ allPermissions, onCreate, onCancel }: Props) {
  const [name, setName] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<number[]>([]);
  const [color, setColor] = useState("#85828B"); // text-sublte by default

  const safeColor = (clr: string) =>
    clr && /^#([0-9a-f]{3}){1,2}$/i.test(clr) ? clr : "#85828B";

  return (
    <motion.div
      key="add-role-modal"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="bg-zinc-900 border border-secondary-border p-4 rounded-xl space-y-4"
    >
      <div className="flex justify-between items-start">
        {/* Name + color */}
        <div className="flex items-center gap-3">
          {/* Color picker */}
          <div className="w-6 h-6 relative shrink-0">
            <label className="block w-full h-full cursor-pointer relative">
              <input
                type="color"
                value={safeColor(color)}
                onChange={(e) => setColor(e.target.value)}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <span
                className="block w-full h-full rounded-full border border-zinc-600 z-0"
                style={{ backgroundColor: safeColor(color) }}
              />
            </label>
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Role name"
            className="bg-transparent border-b border-zinc-600 text-lg font-medium focus:outline-none"
          />
        </div>
        
        <button
          onClick={onCancel}
          className="flex items-center gap-2 mt-2 px-4 py-2 rounded-xl bg-zinc-400/10 text-zinc-300 hover:bg-zinc-400/20 transition-colors text-sm"
        >
          Cancel
        </button>
      </div>

      <div>
        <p className="text-sm text-zinc-400">Permissions</p>
        <div className="flex flex-wrap gap-2 mt-2">
          {allPermissions.map((perm) => {
            const active = selectedPermissions.includes(perm.id);
            return (
              <button
                key={perm.id}
                onClick={() =>
                  setSelectedPermissions((prev) =>
                    active
                      ? prev.filter((id) => id !== perm.id)
                      : [...prev, perm.id]
                  )
                }
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

      <div className="flex justify-end">
        <button
          onClick={() =>
            onCreate({ name: name.trim(), permissionIds: selectedPermissions, color })
          }
          disabled={!name.trim()}
          className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
        >
          Create Role
        </button>
      </div>
    </motion.div>
  );
}
