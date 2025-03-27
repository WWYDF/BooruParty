"use client";

import { useEffect, useState } from "react";
import PostCard from "./PostCard";

type Post = {
  id: number;
  fileName: string;
  uploadedBy: string;
  anonymous: boolean;
  safety: string;
  tags: string[];
  sources: string[];
  notes: string | null;
  flags: string[];
  createdAt: string;
};

type Props = {
  search?: string;
  safety?: string;
  tags?: string[];
  sort?: "new" | "old";
};

export default function PostGrid({ search, safety, tags, sort = "new" }: Props) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (safety) params.set("safety", safety);
      if (tags?.length) params.set("tags", tags.join(","));
      if (sort) params.set("sort", sort);

      try {
        const res = await fetch(`/api/posts?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load posts.");
        const data = await res.json();
        setPosts(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [search, safety, tags, sort]);

  if (loading) return <p className="text-subtle">Loading posts...</p>;
  if (error) return <p className="text-red-500">Error: {error}</p>;
  if (!posts.length) return <p className="text-subtle">No posts found.</p>;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}
