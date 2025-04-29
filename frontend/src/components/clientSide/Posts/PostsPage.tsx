"use client";

import { useState, useEffect, Suspense } from "react";
import SearchBar from "@/components/clientSide/Posts/SearchBar";
import PostGrid from "@/components/clientSide/Posts/PostGrid";
import Filters from "@/components/clientSide/Posts/Filters";
import { getSession } from "next-auth/react";

export default function ClientPostsPage({ initialPosts }: { initialPosts: any[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [viewMode, setViewMode] = useState<"GRID" | "COLLAGE">("GRID");
  const [loadingViewMode, setLoadingViewMode] = useState(true);

  useEffect(() => {
    getSession().then(async (session) => {
      if (!session?.user?.id) return setLoadingViewMode(false);
      const res = await fetch(`/api/users/${session.user.id}`);
      const data = await res.json();
      if (data?.preferences?.layout) setViewMode(data.preferences?.layout);
      setLoadingViewMode(false);
    });
  }, []);

  return (
    <>
      <section className="flex flex-col md:flex-row gap-4">
      <SearchBar
          onSubmit={async (query) => {
            try {
              const res = await fetch(`/api/posts/search?query=${encodeURIComponent(query)}`);
              const data = await res.json();
              setPosts(data.posts || []);
            } catch (err) {
              console.error("Search failed", err);
            }
          }}
        />
        <Filters />
      </section>

      <Suspense fallback={<p className="text-subtle">Loading posts...</p>}>
        {!loadingViewMode ? (
          <PostGrid externalPosts={posts} viewMode={viewMode} />
        ) : (
          <p className="text-subtle">Loading layout preference...</p>
        )}
      </Suspense>
    </>
  );
}
