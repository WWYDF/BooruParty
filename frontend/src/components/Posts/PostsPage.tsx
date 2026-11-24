"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ProhibitIcon } from "@phosphor-icons/react";
import PostGrid from "@/components/Posts/PostGrid";
import PostToolbar from "./PostToolbar";
import QuickMenu from "../Navigation/QuickMenu";
import LoadingOverlay from "../LoadingOverlay";
import MassEditor from "./MassEditor";
import { API, errorText } from "@/core/api";
import { buildQuery } from "@/core/feedQuery";
import { MassEditChange } from "@/core/types/posts";

type Layout = "GRID" | "COLLAGE";
type FeedError = { status: number; text: string };
type FeedSnapshot = { key: string; posts: any[]; cursor: string | null };

const DEFAULT_LAYOUT: Layout = "GRID";
const DEFAULT_PER_PAGE = 30;
const FEED_CACHE_KEY = "bp:feed";

// Browser-specific prefs saved by the Preferences page
function readBrowserPrefs(): { layout: Layout; postsPerPage: number } {
  try {
    const saved = JSON.parse(localStorage.getItem("browserPreferences") ?? "{}");
    const perPage = Number(saved.postsPerPage);
    return {
      layout: saved.layout === "COLLAGE" ? "COLLAGE" : "GRID",
      postsPerPage: Number.isInteger(perPage) ? Math.min(Math.max(perPage, 1), 150) : DEFAULT_PER_PAGE, // API caps at 150
    };
  } catch {
    return { layout: DEFAULT_LAYOUT, postsPerPage: DEFAULT_PER_PAGE };
  }
}

function readSnapshot(): FeedSnapshot | null {
  try {
    return JSON.parse(sessionStorage.getItem(FEED_CACHE_KEY) ?? "null");
  } catch {
    return null;
  }
}


// Wait for enough posts to render before jumping back to where the user was
function restoreScroll(y: number, attempt = 0) {
  if (attempt > 30) return; // ~500ms
  if (document.body.scrollHeight < y + window.innerHeight) {
    requestAnimationFrame(() => restoreScroll(y, attempt + 1));
  } else {
    window.scrollTo({ top: y, behavior: "instant" });
    sessionStorage.removeItem("scrollY");
  }
}

export default function ClientPostsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialText = searchParams.get("query") ?? "";
  const initialSafeties = searchParams.get("safety")?.split("-").filter(Boolean) ?? [];

  // Search: `searchText` is what's in the bar, `activeQuery` is what the feed is showing
  const [searchText, setSearchText] = useState(initialText);
  const [selectedSafeties, setSelectedSafeties] = useState<string[]>(initialSafeties);
  const [activeQuery, setActiveQuery] = useState(() => buildQuery(initialText, initialSafeties));

  // Feed
  const [posts, setPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FeedError | null>(null);
  const [blacklistedHits, setBlacklistedHits] = useState<string[]>([]); // searched tags that are on the viewer's blacklist
  const requestId = useRef(0);
  const perPage = useRef(DEFAULT_PER_PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  // null until localStorage has been read (it only exists in the browser)
  const [layout, setLayout] = useState<Layout | null>(null);

  // Selection
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedPostIds, setSelectedPostIds] = useState<number[]>([]);
  const lastSelectedIndex = useRef<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // `after = null` starts a new search, `after = cursor` loads the next batch
  const loadPosts = async (q: string, after: string | null) => {
    const id = ++requestId.current;
    const params = new URLSearchParams({ q, limit: String(perPage.current) });
    if (after) params.set("cursor", after);
    setLoading(true);

    try {
      const res = await API(`/api/posts?${params}`);
      const data = await res.json();
      if (id !== requestId.current) return; // a newer search replaced this one

      if (!res.ok) {
        setError({ status: res.status, text: errorText(data) });
        setHasMore(false);
        if (!after) setPosts([]);
        return;
      }

      setError(null);
      if (!after) setBlacklistedHits(data.blacklistedTags ?? []); // same for every page of a search; set it once
      setPosts((prev) => (after ? [...prev, ...data.posts] : data.posts));
      setCursor(data.nextCursor);
      setHasMore(data.nextCursor !== null);
      if (!after) sessionStorage.setItem("postCount", String(data.total)); // read by SearchBar
    } catch {
      if (id === requestId.current) setError({ status: 0, text: "Could not reach the server" });
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // First mount: read prefs, then either restore the feed we came back to or load fresh
  useEffect(() => {
    const prefs = readBrowserPrefs();
    perPage.current = prefs.postsPerPage;
    setLayout(prefs.layout);

    // The URL is what this feed shows, so it's what post navigation should follow.
    // (Plain /posts from the navbar = default feed, replacing any older search.)
    sessionStorage.setItem("lastSearchParams", JSON.stringify({ query: initialText, safety: initialSafeties.join("-") }));

    // Clear per-post caches left by the individual post page
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("bp:dims:") || k.startsWith("bp:size:"))
      .forEach((k) => sessionStorage.removeItem(k));

    // PostCard saves scrollY when a post is clicked, so this means "came back from a post"
    const y = Number(sessionStorage.getItem("scrollY") ?? 0);
    const snapshot = readSnapshot();

    if (y > 0 && snapshot?.key === activeQuery) {
      setPosts(snapshot.posts);
      setCursor(snapshot.cursor);
      setHasMore(snapshot.cursor !== null);
      setLoading(false);
      restoreScroll(y);
    } else {
      loadPosts(activeQuery, null);
    }
  }, []);

  // Remember the loaded feed so coming back from a post doesn't refetch everything
  useEffect(() => {
    if (posts.length === 0) return;
    try {
      sessionStorage.setItem(FEED_CACHE_KEY, JSON.stringify({ key: activeQuery, posts, cursor }));
    } catch {
      // sessionStorage full: scroll restore just won't happen
    }
  }, [posts, cursor]);

  // Infinite scroll: load the next batch when the sentinel below the grid gets near the viewport
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || loading || error) return;

    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadPosts(activeQuery, cursor); },
      { rootMargin: "800px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cursor, hasMore, loading, error, activeQuery]);

  // A fresh page load (not coming back from a post) shouldn't restore an old scroll position
  useEffect(() => {
    const handleBeforeUnload = () => sessionStorage.removeItem("scrollY");
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const updateUrl = (text: string, safeties: string[]) => {
    const params = new URLSearchParams();
    if (text) params.set("query", text);
    if (safeties.length > 0) params.set("safety", safeties.join("-"));
    router.replace(`?${params.toString()}`);

    // Read by the individual post page (PostMetadata / PostNavigator)
    sessionStorage.setItem("lastSearchParams", JSON.stringify({ query: text, safety: safeties.join("-") }));
  };

  const search = (text: string = searchText, safeties: string[] = selectedSafeties) => {
    const q = buildQuery(text, safeties);
    setActiveQuery(q);
    setHasMore(false); // stop infinite scroll from loading more of the old search
    window.scrollTo({ top: 0 });
    updateUrl(text, safeties);
    loadPosts(q, null);
  };

  const toggleSafety = (safety: string) => {
    const next = selectedSafeties.includes(safety)
      ? selectedSafeties.filter((s) => s !== safety)
      : [...selectedSafeties, safety];

    setSelectedSafeties(next);
    search(searchText, next);
  };

  function setSelectMode(toggle: boolean) {
    setSelectionMode(toggle);
    if (!toggle) lastSelectedIndex.current = null;
  }

  const toggleSelect = (id: number, e: React.MouseEvent) => {
    const clickedIndex = posts.findIndex((p) => p.id === id);

    setSelectedPostIds((prev) => {
      if (e.shiftKey) {
        const anchor = lastSelectedIndex.current ?? 0; // fallback to top
        return anchor <= clickedIndex
          ? posts.slice(anchor, clickedIndex + 1).map((p) => p.id)
          : posts.slice(clickedIndex, anchor + 1).map((p) => p.id).reverse();
      }

      lastSelectedIndex.current = clickedIndex;
      return prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id];
    });
  };

  // The mass editor gets the selection in feed order (pools append posts in the order sent),
  // not in the order they were clicked
  const selectedSet = new Set(selectedPostIds);
  const selectedInFeedOrder = posts.filter((p) => selectedSet.has(p.id)).map((p) => p.id);

  const handleMassEdit = (change: MassEditChange) => {
    setSelectedPostIds([]);
    setSelectMode(false);

    if (change.deleted?.length) {
      const gone = new Set(change.deleted);
      setPosts((prev) => prev.filter((p) => !gone.has(p.id)));
    }
    if (change.edited) loadPosts(activeQuery, null); // safety/tags may change what this search matches
  };

  return (
    <>
      <PostToolbar
        searchText={searchText}
        setSearchText={setSearchText}
        selectedSafeties={selectedSafeties}
        toggleSafety={toggleSafety}
        searchPosts={search}
        selectionMode={selectionMode}
        selectedPostIds={selectedPostIds}
        setSelectionMode={setSelectMode}
        setSelectedPostIds={setSelectedPostIds}
        setModalOpen={setModalOpen}
      />

      {/* Why a search is empty (or thinner than expected): it asked for tags the viewer hides */}
      {!error && blacklistedHits.length > 0 && (
        <p className="mx-auto mb-4 flex max-w-2xl flex-wrap items-center justify-center gap-x-1.5 rounded-lg border border-red-900/50 bg-red-950/20 px-4 py-2 text-center text-sm text-red-300">
          <ProhibitIcon size={16} className="shrink-0" />
          <span>
            {blacklistedHits.join(", ")} {blacklistedHits.length === 1 ? "is" : "are"} on your blacklist, so matching posts are hidden.
          </span>
          <Link href="/account" className="cursor-pointer text-accent underline-offset-2 hover:underline">Edit blacklist</Link>
        </p>
      )}

      {error ? (
        <FeedMessage error={error} />
      ) : !layout ? (
        <LoadingOverlay show label="Loading Layout..." />
      ) : (
        <PostGrid
          externalPosts={posts}
          viewMode={layout}
          page={1} // only animates the first batch
          postsPerPage={perPage.current}
          selectionMode={selectionMode}
          selectedPostIds={selectedPostIds}
          toggleSelect={toggleSelect}
        />
      )}

      {!error && !loading && posts.length === 0 && (
        <p className="text-center text-subtle py-12">No posts found.</p>
      )}
      {loading && posts.length > 0 && (
        <p className="text-center text-subtle py-6">Loading more...</p>
      )}

      <div ref={sentinel} />

      <MassEditor
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        postIds={selectedInFeedOrder}
        onApplied={handleMassEdit}
      />

      {/* The feed only reads ?query= on mount, so the menu runs its searches through search() */}
      <QuickMenu onSearch={(text) => { setSearchText(text); search(text); }} />
    </>
  );
}

function FeedMessage({ error }: { error: FeedError }) {
  if (error.status === 401) {
    return (
      <div className="flex flex-col items-center text-center px-4 py-16 text-red-400">
        <h1 className="text-3xl font-bold mb-2">Unauthorized</h1>
        <p className="text-base text-subtle max-w-md">
          Guests can't view posts here. Please <a className="text-accent hover:underline" href="/auth/login">log in</a>.
        </p>
      </div>
    );
  }

  if (error.status === 403) {
    return (
      <div className="flex flex-col items-center text-center px-4 py-16 text-red-400">
        <h1 className="text-3xl font-bold mb-2">Forbidden</h1>
        <p className="text-base text-subtle max-w-md">Your account doesn't have permission to view posts.</p>
      </div>
    );
  }

  return <p className="text-center text-red-400 px-4 py-12">{error.text}</p>;
}
