"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateTagModal } from "@/components/clientSide/Tags/CreateModal";

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
  posts: { id: number }[];
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
  const router = useRouter();

  const perPage = 50;

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
      const res = await fetch(`/api/tags?page=${pageNumber}&perPage=${perPage}&search=${encodeURIComponent(searchTerm)}`, {
        cache: 'no-store',
      });
      const data = await res.json();
      setTags(data.tags);
      setTotalPages(data.totalPages);
    } catch (err) {
      console.error("Failed to load tags", err);
    } finally {
      setLoading(false);
    }
  };

  // Refetch when page or debounced search changes
  useEffect(() => {
    fetchTags(page, debouncedSearch);
  }, [page, debouncedSearch]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page when typing
  };

  const handleNewTag = () => {
    router.push("/dashboard/tags/create");
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
        <button
          onClick={() => setCreateModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors whitespace-nowrap"
        >
          + New Tag
        </button>
      </div>
  
      {!loading && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-zinc-100 border-collapse">
            <thead className="border-b border-secondary-border">
              <tr>
                <th className="text-left py-2 px-2">Name</th>
                <th className="text-left py-2 px-2">Category</th>
                <th className="text-left py-2 px-2">Aliases</th>
                <th className="text-left py-2 px-2">Implications</th>
                <th className="text-left py-2 px-2">Suggestions</th>
                <th className="text-left py-2 px-2">Usage</th>
                <th className="text-left py-2 px-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {Array.isArray(tags) && tags.length > 0 ? (
                tags.map((tag) => (
                  <tr key={tag.id} className="border-b border-secondary-border">
                    {/* Name */}
                    <td className="py-2 px-2">
                      <Link
                        href={`/dashboard/tags/${encodeURIComponent(tag.name)}`}
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
                      {tag.posts.length}
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
        </div>
      )}
  
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-4 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="bg-secondary-border hover:bg-secondary px-3 py-1 rounded disabled:opacity-50"
          >
            Previous
          </button>
          <button
            disabled={page === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="bg-secondary-border hover:bg-secondary px-3 py-1 rounded disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      <CreateTagModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={() => {
          setTimeout(() => {
            router.refresh();
          }, 200);
        }}
      />
    </div>
  );
}