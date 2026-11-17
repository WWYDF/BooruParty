'use client';

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import Dropdown from "@/components/UI/Dropdown";
import Pagination from "@/components/UI/Pagination";
import { API, errorText } from "@/core/api";
import { formatCounts } from "@/core/formats";
import { UserSimpleSummary } from "@/core/types/users";
import UserCard from "./UserCard";

type Sort = "newest" | "oldest" | "username";
type PageInfo = { page: number; limit: number; total: number; totalPages: number };

const PER_PAGE = 30;
const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "username", label: "Username (A–Z)" },
];

export default function UserList() {
  // Filters (read from the URL once on mount, so back/forward and shared links restore them)
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<Sort>("newest");
  const [page, setPage] = useState(1);

  const [users, setUsers] = useState<UserSimpleSummary[]>([]);
  const [pagination, setPagination] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("search") ?? "";
    setSearch(s);
    setDebouncedSearch(s);
    const sortParam = params.get("sort") as Sort | null;
    if (sortParam && SORT_OPTIONS.some((o) => o.value === sortParam)) setSort(sortParam);
    setPage(Math.max(1, Number(params.get("page")) || 1));
    setReady(true);
  }, []);

  // Typing waits a moment before searching, and always goes back to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== debouncedSearch) {
        setDebouncedSearch(search);
        setPage(1);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready) return;
    const id = ++requestId.current;

    // Mirror the filters into the URL without adding history entries
    const urlParams = new URLSearchParams();
    if (debouncedSearch) urlParams.set("search", debouncedSearch);
    if (sort !== "newest") urlParams.set("sort", sort);
    if (page > 1) urlParams.set("page", String(page));
    window.history.replaceState(null, "", `?${urlParams}`);

    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE), sort });
    if (debouncedSearch) params.set("search", debouncedSearch);

    setLoading(true);
    API(`/api/users?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (id !== requestId.current) return; // a newer request replaced this one
        if (!res.ok) return setError(errorText(data));
        setError(null);
        setUsers(data.users);
        setPagination(data.pagination);
      })
      .catch(() => { if (id === requestId.current) setError("The server could not be reached."); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [ready, debouncedSearch, sort, page]);

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-8">
      <div>
        <h1 className="text-3xl font-bold text-accent">Users</h1>
        {pagination && (
          <p className="mt-1 text-sm text-subtle">
            {formatCounts(pagination.total)} {pagination.total === 1 ? "user" : "users"}
            {debouncedSearch ? " match" : " in total"}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-secondary-border bg-zinc-900 px-3 focus-within:ring-1 focus-within:ring-zinc-600">
          <MagnifyingGlassIcon size={16} className="shrink-0 text-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search usernames..."
            maxLength={32}
            spellCheck={false}
            className="w-full bg-transparent py-2 text-sm text-white focus:outline-hidden"
          />
        </div>
        <Dropdown
          className="sm:w-48"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(v) => { setSort(v); setPage(1); }}
        />
      </div>

      {error ? (
        <p className="py-10 text-center text-sm text-red-400">{error}</p>
      ) : !loading && users.length === 0 ? (
        <p className="py-10 text-center text-sm text-subtle">
          {debouncedSearch ? <>No users match &quot;{debouncedSearch}&quot;.</> : "No users yet."}
        </p>
      ) : (
        <div className={`grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {users.map((user) => <UserCard key={user.id} user={user} />)}
        </div>
      )}

      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onChange={goToPage} />}
    </main>
  );
}
