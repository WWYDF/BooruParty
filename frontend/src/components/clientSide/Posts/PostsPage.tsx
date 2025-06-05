"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import PostGrid from "@/components/clientSide/Posts/PostGrid";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession } from "next-auth/react";
import MassEditor from "./MassEditor";
import PostToolbar from "./PostToolbar";
import { UserPublic } from "@/core/types/users";

export default function ClientPostsPage({ initialPosts, postsPerPage }: { initialPosts: any[]; postsPerPage: number; }) {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialQuery = searchParams.get("query") ?? "";
  const initialSafeties = searchParams.get("safety")?.split("-").filter(Boolean) ?? [];

  const [posts, setPosts] = useState(initialPosts);
  const [viewMode, setViewMode] = useState<"GRID" | "COLLAGE">("GRID");
  const [loadingViewMode, setLoadingViewMode] = useState(true);
  const [selectedSafeties, setSelectedSafeties] = useState<string[]>(initialSafeties);
  const [searchText, setSearchText] = useState(initialQuery);

  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]);
  const lastSelectedIndex = useRef<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    getSession().then(async (session) => {
      if (!session?.user?.id) return setLoadingViewMode(false);
      const res = await fetch(`/api/users/${session.user.username}`);
      const data: UserPublic = await res.json();
      if (data?.preferences?.layout) setViewMode(data.preferences?.layout);
      setLoadingViewMode(false);
    });
  }, []);

  const updateUrl = (query: string, safeties: string[]) => {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (safeties.length > 0) {
      params.set("safety", safeties.join("-"));
    }
    router.replace(`?${params.toString()}`);

    localStorage.setItem("lastSearchParams", JSON.stringify({
      query: query,
      safety: safeties.join("-"),
    }));
  };

  const toggleSafety = (safety: string) => {
    const nextSafeties = selectedSafeties.includes(safety)
      ? selectedSafeties.filter((s) => s !== safety)
      : [...selectedSafeties, safety];

    setSelectedSafeties(nextSafeties);
    searchPosts(searchText, nextSafeties);
  };

  const searchPosts: (
    queryOverride?: string,
    safetyOverride?: string[],
    pageOverride?: number,
    append?: boolean
  ) => Promise<void> = async (
    queryOverride = searchText,
    safetyOverride = selectedSafeties,
    pageOverride = 1,
    append = false
  ) => {
    const params = new URLSearchParams();
    params.set("query", queryOverride);
    params.set("page", pageOverride.toString());
    params.set("perPage", postsPerPage.toString());
    safetyOverride.forEach((s) => params.append("safety", s));

    try {
      const res = await fetch(`/api/posts?${params.toString()}`);
      const data = await res.json();

      if (append) {
        setPosts((prev) => {
          const existing = new Set(prev.map(p => p.id));
          const filtered = (data.posts || []).filter((p: any) => !existing.has(p.id));
          return [...prev, ...filtered];
        });        
      } else {
        setPosts(data.posts || []);
        updateUrl(queryOverride, safetyOverride); // ONLY update URL on new search, not scroll
      }

      setHasMore((data.posts || []).length > 0);
    } catch (err) {
      console.error("Search failed", err);
    }
  };

  // 🔁 Run initial search on first mount if URL had params
  useEffect(() => {
    if (isFirstLoad.current) {
      const hasQuery = !!initialQuery.trim();
      const hasSafety = initialSafeties.length > 0;
  
      if (hasQuery || hasSafety) {
        searchPosts(initialQuery, initialSafeties);
      } else {
        // No filters in URL → clear localStorage
        localStorage.removeItem("lastSearchParams");
      }
  
      isFirstLoad.current = false;
    }
  }, []);

  // 🌀 Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const fullHeight = document.body.scrollHeight;

      const scrolled = (scrollY + windowHeight) / fullHeight;

      // Percentage of the way through the screen:
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

  function setSelectMode(toggle: boolean) {
    setSelectionMode(toggle);
    if (toggle == false) { lastSelectedIndex.current = null }
  }

  return (
    <>
      <PostToolbar
        searchText={searchText}
        setSearchText={setSearchText}
        selectedSafeties={selectedSafeties}
        toggleSafety={toggleSafety}
        searchPosts={searchPosts}
        selectionMode={selectionMode}
        selectedPostIds={selectedPostIds}
        setSelectionMode={setSelectMode}
        setSelectedPostIds={setSelectedPostIds}
        setModalOpen={setModalOpen}
      />

      <Suspense fallback={<p className="text-subtle">Loading posts...</p>}>
        {!loadingViewMode ? (
          <PostGrid
            externalPosts={posts}
            viewMode={viewMode}
            page={page}
            postsPerPage={postsPerPage ?? 30}
            selectionMode={selectionMode}
            selectedPostIds={selectedPostIds}
            toggleSelect={(id, e) => {
              const clickedIndex = posts.findIndex((p) => p.id === id);
            
              setSelectedPostIds((prev) => {
                if (e.shiftKey) {
                  const anchor = lastSelectedIndex.current ?? 0; // ← fallback to top
                  let range: number[];

                  if (anchor <= clickedIndex) {
                    range = posts.slice(anchor, clickedIndex + 1).map(p => p.id);
                  } else {
                    range = posts.slice(clickedIndex, anchor + 1).map(p => p.id).reverse();
                  }
                  return range;
                }
            
                const alreadySelected = prev.includes(id);
                const next = alreadySelected
                  ? prev.filter((i) => i !== id)
                  : [...prev, id];
            
                lastSelectedIndex.current = clickedIndex;
                return next;
              });
            }}
          />
        ) : (
          <p className="text-subtle">Loading layout preference...</p>
        )}
      </Suspense>
      <MassEditor
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        selectedPosts={selectedPostIds.map(id => posts.find(p => p.id === id)!).filter(Boolean)}
        setSelectedPostIds={setSelectedPostIds}
        setSelectionMode={setSelectionMode}
      />
    </>
  );
}
