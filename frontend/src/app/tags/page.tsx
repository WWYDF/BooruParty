"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import Dropdown from "@/components/UI/Dropdown";
import Pagination from "@/components/UI/Pagination";
import { useUser } from "@/components/UserProvider";
import { CreateTagModal } from "@/components/Tags/CreateModal";
import { CategoryInfo } from "@/components/Posts/Individual/PostView";
import { API, errorText } from "@/core/api";
import { formatCounts } from "@/core/formats";

type Sort = "popular" | "name" | "newest" | "oldest";

// GET /api/tags item
type TagRow = {
  id: number;
  name: string;
  categoryId: number;
  postCount: number;
  category: CategoryInfo;
  names?: { name: string }[]; // only while searching: the names that matched
};

type PageInfo = { page: number; limit: number; total: number; totalPages: number };

const PER_PAGE = 50;
const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "popular", label: "Most used" },
  { value: "name", label: "Name (A–Z)" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export default function TagListPage() {
  const router = useRouter();
  const { user } = useUser();
  const canCreate = user?.permissions.includes("tags.create") ?? false;

  // Filters (read from the URL once on mount, so back/forward and shared links restore them)
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [categoryId, setCategoryId] = useState(0); // 0 = all
  const [sort, setSort] = useState<Sort>("popular");
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<(CategoryInfo & { isDefault?: boolean })[]>([]);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [pagination, setPagination] = useState<PageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("search") ?? "";
    setSearch(s);
    setDebouncedSearch(s);
    setCategoryId(Number(params.get("category")) || 0);
    const sortParam = params.get("sort") as Sort | null;
    if (sortParam && SORT_OPTIONS.some((o) => o.value === sortParam)) setSort(sortParam);
    setPage(Math.max(1, Number(params.get("page")) || 1));
    setReady(true);

    API("/api/tag-categories")
      .then((res) => (res.ok ? res.json() : []))
      .then((cats: CategoryInfo[]) => setCategories([...cats].sort((a, b) => a.index - b.index)))
      .catch(() => {});
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
  }, [search]);

  useEffect(() => {
    if (!ready) return;
    const id = ++requestId.current;

    // Mirror the filters into the URL without adding history entries
    const urlParams = new URLSearchParams();
    if (debouncedSearch) urlParams.set("search", debouncedSearch);
    if (categoryId) urlParams.set("category", String(categoryId));
    if (sort !== "popular") urlParams.set("sort", sort);
    if (page > 1) urlParams.set("page", String(page));
    window.history.replaceState(null, "", `?${urlParams}`);

    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE), sort });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (categoryId) params.set("categoryId", String(categoryId));

    setLoading(true);
    API(`/api/tags?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (id !== requestId.current) return; // a newer request replaced this one
        if (!res.ok) {
          setError(errorText(data));
          return;
        }
        setError(null);
        setTags(data.tags);
        setPagination(data.pagination);
      })
      .catch(() => { if (id === requestId.current) setError("The server could not be reached."); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [ready, debouncedSearch, categoryId, sort, page]);

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const categoryOptions = [
    { value: 0, label: "All categories" },
    ...categories.map((c) => ({ value: c.id, label: c.name, color: c.color })),
  ];

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8 md:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-accent">Tags</h1>
          {pagination && (
            <p className="mt-1 text-sm text-subtle">
              {formatCounts(pagination.total)} {pagination.total === 1 ? "tag" : "tags"}
              {debouncedSearch || categoryId ? " match" : " in total"}
            </p>
          )}
        </div>
        {canCreate && (
          <Button size="md" variant="success" icon={<PlusIcon size={16} />} onClick={() => setCreateOpen(true)}>
            New Tag
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-secondary-border bg-zinc-900 px-3 focus-within:ring-1 focus-within:ring-zinc-600">
          <MagnifyingGlassIcon size={16} className="shrink-0 text-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tags and aliases..."
            spellCheck={false}
            className="w-full bg-transparent py-2 text-sm text-white focus:outline-hidden"
          />
        </div>
        <Dropdown
          className="sm:w-52"
          value={categoryId}
          options={categoryOptions}
          onChange={(v) => { setCategoryId(v); setPage(1); }}
        />
        <Dropdown
          className="sm:w-40"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(v) => { setSort(v); setPage(1); }}
        />
      </div>

      {/* List */}
      <div className="overflow-hidden rounded-xl border border-secondary-border bg-secondary">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-secondary-border px-4 py-2 text-xs font-medium uppercase tracking-wider text-subtle">
          <span>Name</span>
          <span className="w-40">Category</span>
          <span className="w-16 text-right">Posts</span>
        </div>

        {error ? (
          <p className="px-4 py-8 text-center text-sm text-red-400">{error}</p>
        ) : !loading && tags.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-subtle">
            {debouncedSearch ? <>No tags match &quot;{debouncedSearch}&quot;.</> : "No tags yet."}
          </p>
        ) : (
          <ul className={`divide-y divide-secondary-border transition-opacity ${loading ? "opacity-50" : ""}`}>
            {tags.map((tag) => {
              // While searching, show which alias matched ("pkmn → pokemon")
              const alias = tag.names?.find((n) => n.name !== tag.name)?.name;
              const matchedMain = tag.names?.some((n) => n.name === tag.name);
              return (
                <li key={tag.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-zinc-900/60">
                  <span className="min-w-0 truncate">
                    {alias && !matchedMain && <span className="text-subtle">{alias} → </span>}
                    <Link href={`/tags/${encodeURIComponent(tag.name)}`} className="hover:underline" style={{ color: tag.category.color }}>
                      {tag.name}
                    </Link>
                  </span>

                  <span className="flex w-40 items-center gap-2 truncate text-xs text-zinc-400">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: tag.category.color }} />
                    {tag.category.name}
                  </span>

                  <Link
                    href={`/posts?query=${encodeURIComponent(tag.name)}`}
                    className="w-16 text-right text-xs text-zinc-400 tabular-nums hover:text-accent"
                    title={`View ${tag.postCount} posts`}
                  >
                    {formatCounts(tag.postCount)}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Pagination */}
      {pagination && <Pagination page={page} totalPages={pagination.totalPages} onChange={goToPage} />}

      <CreateTagModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        categories={categories}
        onCreated={(tag) => router.push(`/tags/${encodeURIComponent(tag.name)}`)}
      />
    </main>
  );
}
