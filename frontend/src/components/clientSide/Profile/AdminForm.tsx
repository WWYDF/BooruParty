'use client';

import { useEffect, useState } from 'react';
import { useToast } from '../Toast';
import { UserSelf } from '@/core/types/users';

type Role = {
  id: number;
  name: string;
  permissions: {
    id: number;
    name: string;
  }[];
};

export default function UserEditingForm({ user }: { user: UserSelf }) {
  const toast = useToast();

  const [roles, setRoles] = useState<Role[]>([]);
  const [roleId, setRoleId] = useState<number | null>(null);
  // const [restricted, setRestricted] = useState<boolean>(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/system/roles")
      .then((res) => res.ok ? res.json() : [])
      .then((data: Role[]) => setRoles(data));

    setRoleId(user.role.id ?? null);
    // setRestricted(user.restricted ?? false);
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/users/${user.username}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roleId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(`Failed to update user: ${errorData.error}`);
      }

      toast("Admin settings saved!", "success");
    } catch (err: any) {
      toast(err.message || "Error saving settings", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-secondary p-4 rounded-2xl shadow space-y-4 border border-yellow-900">
      <h2 className="text-xl font-semibold text-yellow-300">Admin: User Editing Controls</h2>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block mb-1 text-subtle">Role</label>
          <select
            value={roleId ?? ''}
            onChange={(e) => setRoleId(Number(e.target.value))}
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="" disabled>Select a role</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        {/* <div className="flex-1">
          <label className="block mb-1 text-subtle">Restrict Account</label>
          <select
            value={restricted ? 'YES' : 'NO'}
            onChange={(e) => setRestricted(e.target.value === 'YES')}
            className="w-full p-2 rounded bg-zinc-900 text-white focus:outline-none focus:ring-2 focus:ring-zinc-800"
          >
            <option value="NO">No</option>
            <option value="YES">Yes</option>
          </select>
        </div> */}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="bg-yellow-800 hover:bg-yellow-700 transition text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Admin Settings"}
      </button>
    </section>
  );
}
