"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react";
import { PoolCard } from "./PoolCard";
import { CreatePoolModal } from "./CreateModal";
import Button from "@/components/UI/Button";
import Dropdown from "@/components/UI/Dropdown";
import Pagination from "@/components/UI/Pagination";
import { useUser } from "@/components/UserProvider";
import { API, errorText } from "@/core/api";
import { formatCounts } from "@/core/formats";
import { PoolList, PoolSort, PoolSummary } from "@/core/types/pools";

const PER_PAGE = 24;
const SORT_OPTIONS: { value: PoolSort; label: string }[] = [
  { value: "updated", label: "Recently updated" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "favorites", label: "Most favorited" },
  { value: "size", label: "Most posts" },
  { value: "name", label: "Name (A-Z)" },
];

// "comic 2019" -> text "comic" (or tag), year 2019 (a lone 4-digit number filters by year)
function splitYear(input: string): { text: string; year: number | null } {
  const match = input.match(/(?:^|\s)(\d{4})(?=\s|$)/);
  if (!match) return { text: input.trim(), year: null };
  return { text: input.replace(match[0], " ").trim(), year: Number(match[1]) };
}

export function ClientPoolGrid() {
  const router = useRouter();
  const { user } = useUser();
  const canCreate = user?.permissions.includes("pool.create") ?? false;

  // Filters (read from the URL once on mount, so back/forward and shared links restore them)
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<PoolSort>("updated");
  const [page, setPage] = useState(1);

  const [pools, setPools] = useState<PoolSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("search") ?? "";
    setSearch(s);
    setDebouncedSearch(s);
    const sortParam = params.get("sort") as PoolSort | null;
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
  }, [search]);

  useEffect(() => {
    if (!ready) return;
    const id = ++requestId.current;

    // Mirror the filters into the URL without adding history entries
    const urlParams = new URLSearchParams();
    if (debouncedSearch) urlParams.set("search", debouncedSearch);
    if (sort !== "updated") urlParams.set("sort", sort);
    if (page > 1) urlParams.set("page", String(page));
    window.history.replaceState(null, "", `?${urlParams}`);

    const { text, year } = splitYear(debouncedSearch);
    const params = new URLSearchParams({ page: String(page), limit: String(PER_PAGE), sort });
    if (text) params.set("search", text);
    if (year !== null) params.set("year", String(year));

    setLoading(true);
    API(`/api/pools?${params}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (id !== requestId.current) return; // a newer request replaced this one
        if (!res.ok) {
          setError(errorText(data));
          return;
        }
        const list = data as PoolList;
        setError(null);
        setPools(list.pools);
        setTotal(list.total);
        setTotalPages(list.totalPages);
      })
      .catch(() => { if (id === requestId.current) setError("The server could not be reached."); })
      .finally(() => { if (id === requestId.current) setLoading(false); });
  }, [ready, debouncedSearch, sort, page]);

  const goToPage = (p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <h1 className="text-3xl font-bold text-accent">Pools</h1>
          {total !== null && (
            <p className="mt-1 text-sm text-subtle">
              {formatCounts(total)} {total === 1 ? "pool" : "pools"}
              {debouncedSearch ? " match" : " in total"}
            </p>
          )}
        </div>
        {canCreate && (
          <Button size="lg" variant="success" icon={<PlusIcon size={16} />} onClick={() => setShowModal(true)}>
            New Pool
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row mb-4">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-secondary-border bg-zinc-900 px-3 focus-within:ring-1 focus-within:ring-zinc-600">
          <MagnifyingGlassIcon size={16} className="shrink-0 text-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pools (name, description, year, or a specific tag)..."
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
        <p className="py-8 text-center text-sm text-red-400">{error}</p>
      ) : !loading && pools.length === 0 ? (
        <p className="py-8 text-center text-sm text-subtle">
          {debouncedSearch ? <>No pools match "{debouncedSearch}".</> : "No pools yet."}
        </p>
      ) : (
        <div className={`grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {pools.map((pool, i) => (
            <motion.div
              key={pool.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
            >
              <PoolCard
                name={pool.name}
                artist={pool.artist?.name}
                coverUrl={pool.cover?.thumbnails.med}
                safety={pool.safety}
                linkTo={`/pools/${pool.id}`}
                yearStart={pool.yearStart}
                yearEnd={pool.yearEnd}
                favoriteCount={pool.favoriteCount}
                postCount={pool.postCount}
              />
            </motion.div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <Pagination page={page} totalPages={totalPages} onChange={goToPage} />
      </div>

      <CreatePoolModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(id) => router.push(`/pools/${id}`)}
      />
    </>
  );
}
