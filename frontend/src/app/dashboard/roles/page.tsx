'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder, useDragControls } from "framer-motion";
import {
  ArrowCounterClockwiseIcon,
  CrownIcon,
  DotsSixVerticalIcon,
  FloppyDiskIcon,
  PlusIcon,
  StarIcon,
  TrashIcon,
  UsersIcon,
  WarningIcon,
} from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import Checkbox from "@/components/UI/Checkbox";
import { FullCheckbox } from "@/components/UI/FullCheckbox";
import ConfirmModal from "@/components/UI/Modals/ConfirmModal";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import { API, errorText } from "@/core/api";
import { formatCounts } from "@/core/formats";
import { RoleDetail, RoleDraft } from "@/core/types/roles";

const HEX = /^#[0-9a-f]{6}$/i;
const ADMIN = "administrator"; // admin permission
const MAX_ROLE_NAME = 32; // backend MAX_ROLE_NAME

// Section titles for each permission prefix (anything new falls back to the raw prefix)
const GROUP_LABELS: Record<string, string> = {
  posts: "Posts",
  comment: "Comments",
  pool: "Pools",
  collections: "Collections",
  profile: "Profiles",
  upload: "Uploads",
  limit: "Limits",
  tags: "Tags",
  applications: "Applications",
  dashboard: "Dashboard",
};

// Group by the part before the first dot, keeping the API's order. administrator gets its own toggle.
function groupPermissions(all: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>();
  for (const p of all) {
    if (p === ADMIN) continue;
    const key = p.split(".")[0];
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  return [...groups.entries()];
}

// "posts.edit.others" -> "Edit others"
function permLabel(p: string) {
  const rest = p.split(".").slice(1).join(" ") || p;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
const draftOf = (r: RoleDetail): RoleDraft => ({ name: r.name, color: r.color, permissions: [...r.permissions] });

const inputClass =
  "rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-sm text-zinc-200 focus:outline-hidden focus:ring-1 focus:ring-zinc-600";

// Native color picker + hex text box, kept in sync (same as the Categories page)
function ColorField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={HEX.test(value) ? value : "#ffffff"}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-9 cursor-pointer rounded-lg border border-secondary-border bg-transparent p-0.5"
        title="Pick a color"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        maxLength={7}
        spellCheck={false}
        className={`${inputClass} w-24 font-mono`}
      />
    </div>
  );
}

// One row in the role list. Dragging only starts from the handle, so clicking the row just selects it.
function RoleRow({ role, selected, isOwn, onSelect, onDragEnd }: {
  role: RoleDetail;
  selected: boolean;
  isOwn: boolean;
  onSelect: () => void;
  onDragEnd: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={role}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      layout="position"
      className={`flex items-center gap-1 rounded-xl border px-1.5 py-1.5 transition-colors ${
        selected ? "border-accent/60 bg-accent/5" : "border-secondary-border bg-secondary"
      }`}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label={`Drag ${role.name} to reorder`}
        className="cursor-grab touch-none rounded p-1 text-zinc-600 transition-colors hover:text-zinc-400 active:cursor-grabbing"
      >
        <DotsSixVerticalIcon size={18} />
      </button>

      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-0.5 pr-1 text-left">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: role.color }} />
        <span className="min-w-0 truncate text-sm" style={{ color: role.color }}>{role.name}</span>
        {role.permissions.includes(ADMIN) && <CrownIcon size={13} weight="duotone" className="shrink-0 text-amber-400" aria-label="Administrator" />}
        {role.isDefault && <StarIcon size={13} weight="duotone" className="shrink-0 text-accent" aria-label="Default role" />}
        {isOwn && <span className="shrink-0 rounded-full border border-zinc-700 px-1.5 text-2xs text-subtle">You</span>}
        <span className="ml-auto flex shrink-0 items-center gap-1 text-xs tabular-nums text-zinc-500" title={`${role.userCount} users`}>
          <UsersIcon size={12} />
          {formatCounts(role.userCount)}
        </span>
      </button>
    </Reorder.Item>
  );
}


export default function RolesPage() {
  const toast = useToast();
  const { user } = useUser();

  const [roles, setRoles] = useState<RoleDetail[]>([]);
  const [allPerms, setAllPerms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RoleDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyDefault, setBusyDefault] = useState(false);
  const [pendingSelect, setPendingSelect] = useState<RoleDetail | null>(null); // waiting on "discard changes?"
  const [confirmSelfDemote, setConfirmSelfDemote] = useState(false);
  const [deleting, setDeleting] = useState<RoleDetail | null>(null);

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#9ca3af");
  const [creating, setCreating] = useState(false);

  // Shared request helper: sends JSON, toasts the API's error, returns the body on success
  const send = async <T,>(path: string, method: string, body?: object): Promise<T | null> => {
    try {
      const res = await API(path, {
        method,
        ...(body && { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return null;
      }
      return data as T;
    } catch {
      toast("The server could not be reached", "error");
      return null;
    }
  };

  const select = (role: RoleDetail) => {
    setSelectedId(role.id);
    setDraft(draftOf(role));
  };

  // Initial load: roles + the permission list, then open the top role
  useEffect(() => {
    let cancelled = false;
    Promise.all([API("/api/roles"), API("/api/roles/permissions")])
      .then(async ([rolesRes, permsRes]) => {
        if (!rolesRes.ok || !permsRes.ok) throw new Error();
        const [list, perms]: [RoleDetail[], string[]] = await Promise.all([rolesRes.json(), permsRes.json()]);
        if (cancelled) return;
        setRoles(list);
        setAllPerms(perms);
        if (list[0]) select(list[0]);
      })
      .catch(() => { if (!cancelled) setFailed(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Re-read the list (after a failed reorder) without touching the draft being edited
  const reloadRoles = async () => {
    const list = await send<RoleDetail[]>("/api/roles", "GET");
    if (!list) return;
    setRoles(list);
    if (!list.some((r) => r.id === selectedId) && list[0]) select(list[0]); // the open role was deleted elsewhere
  };

  const selected = roles.find((r) => r.id === selectedId) ?? null;
  const groups = useMemo(() => groupPermissions(allPerms), [allPerms]);

  const dirty = !!(selected && draft && (
    draft.name.trim() !== selected.name ||
    draft.color.toLowerCase() !== selected.color ||
    !sameSet(draft.permissions, selected.permissions)
  ));

  // Leaving the page with unsaved edits: let the browser ask
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Role names are unique, and /api/me only tells us our role's name
  const isOwn = (r: RoleDetail) => user?.role.name === r.name;
  const hasAdmin = draft?.permissions.includes(ADMIN) ?? false;
  const losingOwnAdmin = !!(selected && isOwn(selected) && selected.permissions.includes(ADMIN) && !hasAdmin);

  const requestSelect = (role: RoleDetail) => {
    if (role.id === selectedId) return;
    if (dirty) setPendingSelect(role);
    else select(role);
  };

  const togglePerm = (p: string, on: boolean) =>
    setDraft((d) => d && { ...d, permissions: on ? [...new Set([...d.permissions, p])] : d.permissions.filter((x) => x !== p) });

  const toggleGroup = (perms: string[], on: boolean) =>
    setDraft((d) => d && {
      ...d,
      permissions: on ? [...new Set([...d.permissions, ...perms])] : d.permissions.filter((x) => !perms.includes(x)),
    });

  const save = async (confirmed = false) => {
    if (!selected || !draft || !dirty) return;
    const name = draft.name.trim();
    if (!name) return toast("The role needs a name.", "error");
    if (!HEX.test(draft.color)) return toast("Color must look like #3c9aff.", "error");
    if (losingOwnAdmin && !confirmed) return setConfirmSelfDemote(true);

    // PATCH semantics: only what changed (permissions = the full new list)
    const body: { name?: string; color?: string; permissions?: string[] } = {};
    if (name !== selected.name) body.name = name;
    if (draft.color.toLowerCase() !== selected.color) body.color = draft.color.toLowerCase();
    if (!sameSet(draft.permissions, selected.permissions)) body.permissions = draft.permissions;

    setSaving(true);
    const updated = await send<RoleDetail>(`/api/roles/${selected.id}`, "PATCH", body);
    setSaving(false);
    if (!updated) return;

    // We just gave up our own admin access: this page (and our cached permissions) are no longer valid
    if (losingOwnAdmin) {
      window.location.href = "/";
      return;
    }

    setRoles((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setDraft(draftOf(updated));
    toast(`Saved "${updated.name}"`, "success");
  };

  const makeDefault = async (role: RoleDetail) => {
    setBusyDefault(true);
    const updated = await send<RoleDetail>(`/api/roles/${role.id}`, "PATCH", { isDefault: true });
    setBusyDefault(false);
    if (!updated) return;
    // Only one default at a time: the server cleared the old one
    setRoles((prev) => prev.map((r) => ({ ...r, isDefault: r.id === role.id })));
    toast(`New accounts will now get "${role.name}"`, "success");
  };

  const confirmDelete = async () => {
    const role = deleting;
    setDeleting(null);
    if (!role) return;

    const result = await send<{ movedUsers: number, movedTo: string }>(`/api/roles/${role.id}`, "DELETE");
    if (!result) return;

    // Our own role: we now have the default role's permissions, which may not include this page
    if (isOwn(role)) {
      window.location.href = "/";
      return;
    }

    toast(
      result.movedUsers
        ? `Deleted "${role.name}" (${formatCounts(result.movedUsers)} ${result.movedUsers === 1 ? "user" : "users"} moved to ${result.movedTo})`
        : `Deleted "${role.name}"`,
      "success",
    );

    // Its users now count toward the default role; open the next role in the list
    const rest = roles
      .filter((r) => r.id !== role.id)
      .map((r) => (r.isDefault ? { ...r, userCount: r.userCount + result.movedUsers } : r));
    setRoles(rest);
    if (rest[0]) select(rest.find((r) => r.index > role.index) ?? rest[rest.length - 1]);
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return toast("The role needs a name.", "error");
    if (!HEX.test(newColor)) return toast("Color must look like #3c9aff.", "error");

    setCreating(true);
    const created = await send<RoleDetail>("/api/roles", "POST", { name, color: newColor.toLowerCase() });
    setCreating(false);
    if (!created) return;

    setRoles((prev) => [...prev, created]);
    setNewName("");
    toast(`Created "${created.name}"`, "success");
    if (dirty) setPendingSelect(created);
    else select(created);
  };

  // The latest order, for the drop handler (it can fire before React re-renders with the final position)
  const rolesRef = useRef(roles);
  rolesRef.current = roles;

  // Runs when a row is dropped: one PUT with every id in the new order
  const saveOrder = async () => {
    const current = rolesRef.current;
    if (current.every((r, i) => r.index === i)) return; // dropped where it started

    const saved = await send<RoleDetail[]>("/api/roles/reorder", "PUT", { ids: current.map((r) => r.id) });
    // Failed, e.g. 409 because a role was added meanwhile (already toasted): reload the truth
    if (saved) setRoles(saved);
    else reloadRoles();
  };

  if (loading) return <p className="py-10 text-center text-sm text-zinc-600">Loading...</p>;
  if (failed) return <p className="py-10 text-center text-sm text-red-400">Could not load roles.</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Roles</h1>
        <p className="mt-1 text-sm text-subtle">
          What each group of users can do. Changes apply on their very next request, no re-login needed.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[20rem_1fr]">
        {/* Left: create + list */}
        <div className="space-y-4">
          <section className="rounded-xl border border-secondary-border bg-zinc-900/40 p-4">
            <h2 className="mb-3 text-sm font-medium text-zinc-200">New role</h2>
            <form onSubmit={create} className="space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name"
                maxLength={MAX_ROLE_NAME}
                className={`${inputClass} w-full`}
              />
              <div className="flex items-center justify-between gap-2">
                <ColorField value={newColor} onChange={setNewColor} />
                <Button type="submit" variant="success" icon={<PlusIcon size={16} weight="bold" />} loading={creating}>
                  Create
                </Button>
              </div>
            </form>
            <p className="mt-2 text-xs text-zinc-600">New roles start with no permissions, at the bottom of the list.</p>
          </section>

          <section className="rounded-xl border border-secondary-border bg-zinc-900/40 p-4">
            <h2 className="text-sm font-medium text-zinc-200">All roles</h2>
            <p className="mb-3 text-xs text-subtle">Drag the handle to reorder (saves when you drop). Top = highest.</p>
            <Reorder.Group axis="y" values={roles} onReorder={setRoles} className="space-y-1.5">
              {roles.map((r) => (
                <RoleRow
                  key={r.id}
                  role={r}
                  selected={r.id === selectedId}
                  isOwn={isOwn(r)}
                  onSelect={() => requestSelect(r)}
                  onDragEnd={saveOrder}
                />
              ))}
            </Reorder.Group>
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-2xs text-zinc-600 ml-3">
              <span className="flex items-center gap-1"><CrownIcon size={11} weight="duotone" className="text-amber-400" /> Administrator</span>
              <span className="flex items-center gap-1"><StarIcon size={11} weight="duotone" className="text-accent" /> Default for new accounts</span>
            </p>
          </section>
        </div>

        {/* Right: editor */}
        {selected && draft ? (
          <section className="rounded-xl border border-secondary-border bg-zinc-900/40 p-5">
            <div className="flex flex-wrap items-end gap-3">
              <label className="min-w-48 flex-1">
                <span className="mb-1 block text-xs font-medium text-zinc-400">Name</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  maxLength={MAX_ROLE_NAME}
                  className={`${inputClass} w-full`}
                  style={{ color: HEX.test(draft.color) ? draft.color : undefined }}
                />
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-zinc-400">Color</span>
                <ColorField value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
              </div>
              {selected.isDefault ? (
                <span className="flex h-9 items-center gap-1.5 rounded-lg border border-accent/40 bg-accent/10 px-3 text-xs text-accent">
                  <StarIcon size={14} weight="fill" /> Default role
                </span>
              ) : (
                <Button
                  icon={<StarIcon size={14} />}
                  loading={busyDefault}
                  onClick={() => makeDefault(selected)}
                  title="New accounts will get this role"
                  className="h-9"
                >
                  Make default
                </Button>
              )}
              <Button
                variant="danger"
                icon={<TrashIcon size={14} />}
                disabled={selected.isDefault || saving}
                onClick={() => setDeleting(selected)}
                title={selected.isDefault ? "The default role can't be deleted. Make another role the default first" : "Delete this role"}
                className="h-9"
              >
              </Button>
            </div>

            <p className="mt-2 text-xs text-subtle">
              {formatCounts(selected.userCount)} {selected.userCount === 1 ? "user has" : "users have"} this role.
              {selected.isDefault && " New accounts get it."}
            </p>

            {/* Save sits above the permissions so it's in reach without scrolling past every group */}
            <div className="mt-4 flex items-center justify-end gap-2 border-t border-secondary-border pt-4">
              {dirty && <span className="mr-auto text-xs text-amber-300">Unsaved changes</span>}
              <Button icon={<ArrowCounterClockwiseIcon size={14} />} disabled={!dirty || saving} onClick={() => setDraft(draftOf(selected))}>
                Reset
              </Button>
              <Button variant="success" icon={<FloppyDiskIcon size={14} />} loading={saving} disabled={!dirty} onClick={() => save()}>
                Save changes
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <FullCheckbox
                checked={hasAdmin}
                onChange={(on) => togglePerm(ADMIN, on)}
                icon={<CrownIcon size={18} />}
                label="Administrator"
                description="Grants every permission (including ones added in future updates) and access to this page."
              />

              {losingOwnAdmin && (
                <p className="flex items-start gap-2 rounded-lg border border-amber-600/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                  <WarningIcon size={14} weight="bold" className="mt-0.5 shrink-0" />
                  This is your own role. Saving without Administrator removes your access to role management.
                </p>
              )}
            </div>

            {hasAdmin && (
              <p className="mt-4 text-xs text-subtle">Administrator already grants everything below; these only matter if it&apos;s removed.</p>
            )}

            <div className={`mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${hasAdmin ? "opacity-50" : ""}`}>
              {groups.map(([key, perms]) => {
                const on = perms.filter((p) => draft.permissions.includes(p)).length;
                const all = on === perms.length;
                return (
                  <div key={key} className="rounded-lg border border-secondary-border bg-zinc-900/40 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-200">
                        {GROUP_LABELS[key] ?? key}{" "}
                        <span className="text-xs font-normal tabular-nums text-zinc-500">{on}/{perms.length}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => toggleGroup(perms, !all)}
                        className="cursor-pointer text-xs text-accent hover:underline"
                      >
                        {all ? "None" : "All"}
                      </button>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {perms.map((p) => (
                        <Checkbox
                          key={p}
                          checked={draft.permissions.includes(p)}
                          onChange={(v) => togglePerm(p, v)}
                          title={p}
                          label={permLabel(p)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

          </section>
        ) : (
          <p className="rounded-xl border border-dashed border-zinc-700 py-12 text-center text-sm text-subtle">Pick a role to edit it.</p>
        )}
      </div>

      <ConfirmModal
        open={!!pendingSelect}
        onClose={() => setPendingSelect(null)}
        onConfirm={() => {
          if (pendingSelect) select(pendingSelect);
          setPendingSelect(null);
        }}
        title="Discard changes?"
        description={`Your unsaved changes to "${selected?.name}" will be lost.`}
        confirmText="Discard"
        cancelText="Keep editing"
      />

      <ConfirmModal
        open={confirmSelfDemote}
        onClose={() => setConfirmSelfDemote(false)}
        onConfirm={() => {
          setConfirmSelfDemote(false);
          save(true);
        }}
        title="Remove your own admin access?"
        description={"You won't be able to open this page or manage roles afterwards.\nAnother administrator would have to give it back."}
        confirmText="Remove it"
      />

      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={`Delete "${deleting?.name}"?`}
        description={[
          deleting?.userCount
            ? `Its ${formatCounts(deleting.userCount)} ${deleting.userCount === 1 ? "user moves" : "users move"} to ${roles.find((r) => r.isDefault)?.name ?? "the default role"}.`
            : "Nobody has this role.",
          deleting && isOwn(deleting) ? "This is your own role: you'll get the default role's permissions instead." : "",
          "This can't be undone.",
        ].filter(Boolean).join("\n")}
        confirmText="Delete"
      />
    </div>
  );
}
