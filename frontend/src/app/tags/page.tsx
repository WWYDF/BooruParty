"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateTagModal } from "@/components/clientSide/Tags/CreateModal";
import { checkPermissions } from "@/core/permissions";
import { CaretUpDown } from "@phosphor-icons/react";
import { CaretDown, CaretUp } from "phosphor-react";

type TagListType = {
  id: number;
  name: string;
  category: {
    id: number;
    name: string;
    color: string;
  };
  aliases: { alias: string }[];
  implications: { name: string }[];
  suggestions: { name: string }[];
  _count: { posts: number };
  createdAt: string;
};

export default function TagListPage() {
  const [tags, setTags] = useState<TagListType[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [canCreateTag, setCanCreateTag] = useState(false);
  const [sortField, setSortField] = useState<"name" | "category" | "usages" | "createdAt">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const router = useRouter();

  const perPage = 50;

  // Check if they can make tags
  useEffect(() => {
    const check = async () => {
      const res = (await checkPermissions(['tags_create']))['tags_create'];
      setCanCreateTag(res);
    };
    check();
  }, []);

  // Debounce search input by 500ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(handler);
  }, [search]);

  // Fetch tags from API
  const fetchTags = async (pageNumber = 1, searchTerm = "") => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/tags?page=${pageNumber}&perPage=${perPage}&search=${encodeURIComponent(searchTerm)}&sort=${sortField}&order=${sortOrder}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setTags(data.tags);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to load tags", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSort = (field: typeof sortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };
  

  // Refetch when page or debounced search changes
  useEffect(() => {
    fetchTags(page, debouncedSearch);
  }, [page, debouncedSearch, sortField, sortOrder]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page when typing
  };


  return (
    <div className="space-y-6 px-4 md:px-8 mt-8">
      <h1 className="text-3xl font-bold text-accent">Tags</h1>
  
      {/* Top bar: Search + Create */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Search tags..."
          className="bg-secondary p-2 rounded border border-secondary-border w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-zinc-700"
        />
        {canCreateTag && (
          <button
            onClick={() => setCreateModalOpen(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors whitespace-nowrap"
          >
            + New Tag
          </button>
        )}
      </div>
  
      {!loading && (
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-zinc-600">Loading...</div>
          ) : (
            <table className="w-full text-sm text-zinc-100 border-collapse">
              <thead className="border-b border-secondary-border">
              <tr>
                <th
                  className="text-left py-2 px-2 cursor-pointer select-none hover:text-accent font-medium"
                  onClick={() => toggleSort("name")}
                >
                  <span className="inline-flex items-center gap-1">
                    Name
                    {sortField === "name" ? (
                      sortOrder === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />
                    ) : (
                      <CaretUpDown size={14} className="opacity-50" />
                    )}
                  </span>
                </th>

                <th
                  className="text-left py-2 px-2 cursor-pointer select-none hover:text-accent font-medium"
                  onClick={() => toggleSort("category")}
                >
                  <span className="inline-flex items-center gap-1">
                    Category
                    {sortField === "category" ? (
                      sortOrder === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />
                    ) : (
                      <CaretUpDown size={14} className="opacity-50" />
                    )}
                  </span>
                </th>

                <th className="text-left py-2 px-2">Aliases</th>
                <th className="text-left py-2 px-2">Implications</th>
                <th className="text-left py-2 px-2">Suggestions</th>

                <th
                  className="text-left py-2 px-2 cursor-pointer select-none hover:text-accent font-medium"
                  onClick={() => toggleSort("usages")}
                >
                  <span className="inline-flex items-center gap-1">
                    Usages
                    {sortField === "usages" ? (
                      sortOrder === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />
                    ) : (
                      <CaretUpDown size={14} className="opacity-50" />
                    )}
                  </span>
                </th>

                <th
                  className="text-left py-2 px-2 cursor-pointer select-none hover:text-accent font-medium"
                  onClick={() => toggleSort("createdAt")}
                >
                  <span className="inline-flex items-center gap-1">
                    Created
                    {sortField === "createdAt" ? (
                      sortOrder === "asc" ? <CaretUp size={14} /> : <CaretDown size={14} />
                    ) : (
                      <CaretUpDown size={14} className="opacity-50" />
                    )}
                  </span>
                </th>
              </tr>

              </thead>
              <tbody>
                {Array.isArray(tags) && tags.length > 0 ? (
                  tags.map((tag) => (
                    <tr key={tag.id} className="border-b border-secondary-border">
                      {/* Name */}
                      <td className="py-2 px-2">
                        <Link
                          href={`/tags/${encodeURIComponent(tag.name)}`}
                          className="hover:underline text-accent"
                        >
                          {tag.name}
                        </Link>
                      </td>

                      {/* Category */}
                      <td className="py-2 px-2">
                        {tag.category ? (
                          <span style={{ color: tag.category.color }}>
                            {tag.category.name}
                          </span>
                        ) : (
                          <span className="text-zinc-600">(none)</span>
                        )}
                      </td>

                      {/* Aliases */}
                      <td className="py-2 px-2">
                        {tag.aliases.length > 0
                          ? tag.aliases.map((a) => a.alias).join(", ")
                          : <span className="text-zinc-600">(none)</span>}
                      </td>

                      {/* Implications */}
                      <td className="py-2 px-2">
                        {tag.implications.length > 0
                          ? tag.implications.map((i) => i.name).join(", ")
                          : <span className="text-zinc-600">(none)</span>}
                      </td>

                      {/* Suggestions */}
                      <td className="py-2 px-2">
                        {tag.suggestions.length > 0
                          ? tag.suggestions.map((s) => s.name).join(", ")
                          : <span className="text-zinc-600">(none)</span>}
                      </td>

                      {/* Usage */}
                      <td className="py-2 px-2">
                        {tag._count.posts}
                      </td>

                      {/* Created */}
                      <td className="py-2 px-2">
                        {new Date(tag.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : !loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-6 text-zinc-600">
                      No tags found.
                    </td>
                  </tr>
                ) : null}
              </tbody>

            </table>
          )}
        </div>
      )}
  
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1 mt-6 text-sm pb-6">
          {/* Prev Arrow */}
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-2 py-1 rounded bg-secondary-border hover:bg-secondary disabled:opacity-50"
          >
            &lt;
          </button>

          {/* First Page */}
          <button
            onClick={() => setPage(1)}
            className={`px-3 py-1 rounded ${
              page === 1 ? "bg-accent text-white" : "bg-secondary-border hover:bg-secondary"
            }`}
          >
            1
          </button>

          {/* Left Ellipsis */}
          {page > 3 && <span className="px-2 text-zinc-500">...</span>}

          {/* Dynamic middle buttons */}
          {Array.from({ length: 3 }, (_, i) => page - 1 + i)
            .filter((p) => p > 1 && p < totalPages)
            .map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`px-3 py-1 rounded ${
                  p === page ? "bg-accent text-white" : "bg-secondary-border hover:bg-secondary"
                }`}
              >
                {p}
              </button>
            ))}

          {/* Right Ellipsis */}
          {page < totalPages - 2 && <span className="px-2 text-zinc-500">...</span>}

          {/* Last Page */}
          {totalPages > 1 && (
            <button
              onClick={() => setPage(totalPages)}
              className={`px-3 py-1 rounded ${
                page === totalPages ? "bg-accent text-white" : "bg-secondary-border hover:bg-secondary"
              }`}
            >
              {totalPages}
            </button>
          )}

          {/* Next Arrow */}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-2 py-1 rounded bg-secondary-border hover:bg-secondary disabled:opacity-50"
          >
            &gt;
          </button>
        </div>
      )}

      <CreateTagModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          setTimeout(() => {
            window.location.reload();
          }, 200);
        }}
      />
    </div>
  );
}