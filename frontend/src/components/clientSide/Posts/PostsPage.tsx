"use client";

import { useState, useEffect, Suspense } from "react";
import SearchBar from "@/components/clientSide/Posts/SearchBar";
import PostGrid from "@/components/clientSide/Posts/PostGrid";
import Filters from "@/components/clientSide/Posts/Filters";
import { getSession } from "next-auth/react";

export default function ClientPostsPage({ initialPosts, postsPerPage }: { initialPosts: any[]; postsPerPage: number; }) {
  const [posts, setPosts] = useState(initialPosts);
  const [viewMode, setViewMode] = useState<"GRID" | "COLLAGE">("GRID");
  const [loadingViewMode, setLoadingViewMode] = useState(true);
  const [selectedSafeties, setSelectedSafeties] = useState<string[]>([]);
  const [searchText, setSearchText] = useState("");

  const [page, setPage] = useState(1); // Page 1 = already preloaded (initialPosts)
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

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
  queryOverride: string = searchText,
  safetyOverride: string[] = selectedSafeties,
  pageOverride: number = 1,
  append: boolean = false
) => {
  const params = new URLSearchParams();
  params.set("query", queryOverride);
  params.set("page", pageOverride.toString());
  params.set("perPage", postsPerPage.toString());
  safetyOverride.forEach((s) => params.append("safety", s));

  try {
    const res = await fetch(`/api/posts/search?${params.toString()}`);
    const data = await res.json();

    if (append) {
      setPosts((prev) => [...prev, ...(data.posts || [])]);
    } else {
      setPosts(data.posts || []);
    }

    setHasMore((data.posts || []).length > 0);
  } catch (err) {
    console.error("Search failed", err);
  }
};

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const fullHeight = document.body.scrollHeight;

      const scrolled = (scrollY + windowHeight) / fullHeight;

      if (scrolled > 0.75 && !isLoadingMore && hasMore) {
        setIsLoadingMore(true);
        const nextPage = page + 1;
        setPage(nextPage);

        searchPosts(searchText, selectedSafeties, nextPage, true).then(() => {
          setIsLoadingMore(false);
        });
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [page, searchText, selectedSafeties, isLoadingMore, hasMore]);


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
