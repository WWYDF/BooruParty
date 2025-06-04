"use client";

import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { auditLogColors } from "@/core/dictionary";
import { CaretDown, CaretUp, Trash } from "phosphor-react";
import { useEffect, useState } from "react";

type AuditLog = {
  executedAt: string;
  category: string;
  actionType: string;
  details: string | null;
  address: string | null;
  user: {
    id: string;
    username: string;
    avatar: string | null;
    role: { name: string };
  };
};

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timeout);
  }, [value, delay]);

  return debounced;
}

function AuditLogRow({ log }: { log: AuditLog }) {
  const [open, setOpen] = useState(false);
  const hasChanges = log.details?.includes("Changes:");

  return (
    <div className="p-3 border-b border-zinc-800 last:border-b-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      <div className="w-full">
        <div className={`text-sm font-medium ${auditLogColors[log.category] || "text-subtle"}`}>
          {log.category} → {log.actionType}
        </div>

        {hasChanges ? (
          <>
            <button
              onClick={() => setOpen(!open)}
              className="flex items-center gap-1 text-xs text-accent hover:underline mt-1"
            >
              {open ? "Hide changes" : "Show changes"}
              {open ? <CaretUp size={14} /> : <CaretDown size={14} />}
            </button>
            {open && (
              <pre className="mt-2 p-2 rounded text-xs bg-zinc-900 border border-zinc-800 whitespace-pre-wrap">
                {log.details}
              </pre>
            )}
          </>
        ) : (
          <div className="text-xs text-subtle">{log.details}</div>
        )}
      </div>

      <div className="text-xs text-subtle whitespace-nowrap">
        {new Date(log.executedAt).toLocaleString()}<br />
        From: {log.address}<br />
        by <strong>{log.user.username}</strong>
        <RoleBadge role={log.user.role} classes="text-2xs" />
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [category, setCategory] = useState("");
  const [actionType, setActionType] = useState("");
  const [usernameSearch, setUsernameSearch] = useState("");
  const debouncedUsername = useDebouncedValue(usernameSearch, 300);

  useEffect(() => {
    const params = new URLSearchParams({ page: page.toString() });
  
    if (category) params.set("category", category);
    if (actionType) params.set("actionType", actionType);
    if (debouncedUsername) params.set("username", debouncedUsername);
  
    fetch(`/api/dashboard/logs?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setLogs(data.logs);
        setTotalPages(data.totalPages);
      });
  }, [page, category, actionType, debouncedUsername]);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 items-center">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border rounded px-2 py-1 bg-secondary border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
        >
          <option value="">All Categories</option>
          <option value="EDIT">Edit</option>
          <option value="DELETE">Delete</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
        </select>
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="border rounded px-2 py-1 bg-secondary border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
        >
          <option value="">All Actions</option>
          <option value="POST">Post</option>
          <option value="COMMENT">Comment</option>
          <option value="PROFILE">Profile</option>
          <option value="TAG">Tag</option>
          <option value="CATEGORY">Category</option>
          <option value="SITE_SETTINGS">Site Settings</option>
          <option value="PERMISSIONS">Permissions</option>
          <option value="FEATURE">Feature</option>
        </select>
        <input
          type="text"
          placeholder="Search by username"
          value={usernameSearch}
          onChange={(e) => setUsernameSearch(e.target.value)}
          className="border rounded px-2 py-1 bg-secondary border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-800"
        />
        <button
          onClick={() => {
            setCategory("");
            setActionType("");
            setUsernameSearch("");
            setPage(1);
          }}
          className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-900 transition text-white flex items-center justify-center"
          title="Clear filters"
        >
          <Trash size={16} weight="bold" />
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden border-zinc-800">
      {logs.map((log, i) => (
        <AuditLogRow key={i} log={log} />
      ))}
      </div>

      <div className="flex justify-between items-center">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="text-sm text-accent disabled:opacity-50"
        >
          ← Previous
        </button>
        <span className="text-sm text-subtle">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page >= totalPages}
          className="text-sm text-accent disabled:opacity-50"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
