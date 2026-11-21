'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { CopyIcon, KeyIcon, MagnifyingGlassIcon, TrashIcon, UserIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import ConfirmModal from "@/components/UI/Modals/ConfirmModal";
import Pagination from "@/components/UI/Pagination";
import { useToast } from "@/components/UI/Toast";
import { API, errorText } from "@/core/api";
import { formatCounts, formatRelativeTime } from "@/core/formats";

const PAGE_SIZE = 25;

// GET /api/applications/all
type AdminApplication = {
  clientId: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  owner: {
    id: string;
    username: string;
    avatar?: string | null; // URL once the API maps avatarKey -> avatar; default avatar until then
    role: { name: string, color: string | null } | null;
  };
};

type AdminApplicationList = {
  applications: AdminApplication[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

const inputWrap = "flex items-center gap-2 rounded-lg border border-secondary-border bg-zinc-900 px-3 py-2 text-sm focus-within:ring-1 focus-within:ring-zinc-600";

// Every API key on the site, with who owns it. Mods can revoke them; secrets are never visible here.
export default function ApplicationsDashboardPage() {
  const toast = useToast();

  const [q, setQ] = useState("");
  const [owner, setOwner] = useState("");
  const [filters, setFilters] = useState({ q: "", owner: "" }); // debounced copy of the inputs
  const [page, setPage] = useState(1);

  const [data, setData] = useState<AdminApplicationList | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [revoking, setRevoking] = useState<AdminApplication | null>(null);

  // Typing settles for 300ms before searching; a new search starts back at page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters({ q: q.trim(), owner: owner.trim() });
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [q, owner]);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
    if (filters.q) params.set("q", filters.q);
    if (filters.owner) params.set("owner", filters.owner);

    API(`/api/applications/all?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((list: AdminApplicationList) => { if (!cancelled) setData(list); })
      .catch(() => { if (!cancelled) setFailed(true); });

    return () => { cancelled = true; };
  }, [filters, page, reload]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast("Client ID copied", "success");
    } catch {
      toast("Could not copy. Select it and copy manually", "error");
    }
  };

  const revoke = async () => {
    const app = revoking;
    setRevoking(null);
    if (!app) return;

    try {
      const res = await API(`/api/applications/${app.clientId}?userId=${encodeURIComponent(app.owner.id)}`, { method: "DELETE" });
      if (!res.ok) return toast(errorText(await res.json().catch(() => ({}))), "error");
      toast(`Revoked "${app.name}"`, "success");

      // Last row on a later page: step back instead of showing an empty page
      if (data && data.applications.length === 1 && page > 1) setPage(page - 1);
      else setReload((r) => r + 1);
    } catch {
      toast("The server could not be reached", "error");
    }
  };

  const filtering = !!(filters.q || filters.owner);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Applications</h1>
        <p className="mt-1 text-sm text-subtle">
          API keys made by users. Each one acts as its owner's account. Revoking one stops it immediately; secrets are never shown here.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className={`${inputWrap} sm:flex-1`}>
          <MagnifyingGlassIcon size={16} className="shrink-0 text-zinc-500" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by app name"
            maxLength={64}
            className="w-full bg-transparent text-zinc-200 placeholder:text-zinc-600 focus:outline-hidden"
          />
        </label>
        <label className={`${inputWrap} sm:w-64`}>
          <UserIcon size={16} className="shrink-0 text-zinc-500" />
          <input
            type="text"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Owner's exact username"
            maxLength={32}
            spellCheck={false}
            className="w-full bg-transparent text-zinc-200 placeholder:text-zinc-600 focus:outline-hidden"
          />
        </label>
      </div>

      {failed ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/10 px-4 py-3 text-sm text-red-300">
          Could not load applications.
          <Button size="sm" onClick={() => setReload((r) => r + 1)}>Retry</Button>
        </div>
      ) : data === null ? (
        <p className="animate-pulse py-10 text-center text-sm text-subtle">Loading...</p>
      ) : data.applications.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-zinc-700 py-12 text-center">
          <KeyIcon size={28} className="text-zinc-600" />
          <p className="text-sm text-subtle">{filtering ? "No applications match." : "Nobody has made an application yet."}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-subtle">
            {formatCounts(data.total)} {data.total === 1 ? "application" : "applications"}
            {filtering && " found"}
          </p>

          <div className="overflow-x-auto rounded-lg border border-secondary-border">
            <table className="w-full min-w-160 text-left text-sm">
              <thead className="border-b border-secondary-border bg-zinc-900/60 text-xs text-subtle">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Application</th>
                  <th className="px-4 py-2.5 font-medium">Owner</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                  <th className="px-4 py-2.5 font-medium">Last used</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-secondary-border">
                {data.applications.map((app) => (
                  <tr key={app.clientId} className="transition-colors hover:bg-zinc-900/40">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 text-zinc-200">
                        <KeyIcon size={14} className="shrink-0 text-zinc-500" />
                        <span className="truncate">{app.name}</span>
                      </p>
                      <button
                        type="button"
                        onClick={() => copy(app.clientId)}
                        title="Copy client ID"
                        className="mt-0.5 flex cursor-pointer items-center gap-1 font-mono text-2xs text-zinc-500 transition-colors hover:text-zinc-300"
                      >
                        {app.clientId}
                        <CopyIcon size={11} className="shrink-0" />
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/users/${encodeURIComponent(app.owner.username)}`} className="flex min-w-0 items-center gap-2 hover:underline">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={app.owner.avatar ?? "/i/user.png"}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded-full border border-secondary-border object-cover"
                          />
                          <span className="truncate" style={{ color: app.owner.role?.color ?? undefined }}>
                            {app.owner.username}
                          </span>
                        </Link>
                        {/* Quick filter: everything this user owns */}
                        {filters.owner !== app.owner.username && (
                          <button
                            type="button"
                            onClick={() => setOwner(app.owner.username)}
                            title={`Only show ${app.owner.username}'s applications`}
                            className="cursor-pointer rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                          >
                            <MagnifyingGlassIcon size={12} />
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="whitespace-nowrap px-4 py-3 text-xs text-subtle" title={new Date(app.createdAt).toLocaleString()}>
                      {formatRelativeTime(app.createdAt)}
                    </td>

                    <td
                      className="whitespace-nowrap px-4 py-3 text-xs text-subtle"
                      title={app.lastUsedAt ? new Date(app.lastUsedAt).toLocaleString() : undefined}
                    >
                      {app.lastUsedAt ? formatRelativeTime(app.lastUsedAt) : <span className="text-zinc-600">Never</span>}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="danger" icon={<TrashIcon size={12} />} onClick={() => setRevoking(app)}>
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination page={page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}

      <ConfirmModal
        open={!!revoking}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title="Revoke application?"
        description={`"${revoking?.name}" (owned by ${revoking?.owner.username}) will stop working immediately. This can't be undone.`}
        confirmText="Revoke"
      />
    </div>
  );
}
