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
  const [selectedSafeties, setSelectedSafeties] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");

  useEffect(() => {
    getSession().then(async (session) => {
      if (!session?.user?.id) return setLoadingViewMode(false);
      const res = await fetch(`/api/users/${session.user.id}`);
      const data = await res.json();
      if (data?.preferences?.layout) setViewMode(data.preferences?.layout);
      setLoadingViewMode(false);
    });
  }, []);

  const toggleSafety = (safety: string) => {
    const nextSafeties = selectedSafeties.includes(safety)
      ? selectedSafeties.filter((s) => s !== safety)
      : [...selectedSafeties, safety];
  
    setSelectedSafeties(nextSafeties);
    searchPosts(searchText, nextSafeties);
  };  

  const searchPosts = async (
    queryOverride?: string,
    safetyOverride?: string[]
  ) => {
    const params = new URLSearchParams();
    params.set("query", queryOverride ?? searchText);
  
    const safetiesToUse = safetyOverride ?? selectedSafeties;
    safetiesToUse.forEach((s) => params.append("safety", s));
  
    const res = await fetch(`/api/posts/search?${params.toString()}`);
    const data = await res.json();
    setPosts(data.posts || []);
  };

  return (
    <>
      <section className="flex flex-col md:flex-row gap-4">
        <SearchBar
          input={searchText}
          setInput={setSearchText}
          onSubmit={searchPosts}
        />
        <Filters
          selectedSafeties={selectedSafeties}
          toggleSafety={toggleSafety}
          triggerSearch={() => searchPosts()}
        />
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
