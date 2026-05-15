'use client'
import { BookmarksSimpleIcon, CheckIcon, PlusIcon, SparkleIcon, StarIcon, ThumbsDownIcon, ThumbsUpIcon } from "@phosphor-icons/react";
import { useState, useRef, useEffect } from "react";
import { PostUserStatus } from "@/core/types/posts";
import { useToast } from "../../Toast";
import { useRouter } from "next/navigation";

type VoteType = "UPVOTE" | "DOWNVOTE" | null;

type Props = {
  post: {
    id: number;
    score: number;
    favorites?: number;
  },
  user: PostUserStatus;
};

export default function PostVoting({ post, user }: Props) {
  const [vote, setVote] = useState<VoteType>(user.vote);
  const [favorited, setFavorited] = useState(user.favorited);
  const [boosted, setBoosted] = useState(user.boostedToday);
  const [loading, setLoading] = useState(false);
  const [collectionOpen, setCollectionOpen] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [checkedCollections, setCheckedCollections] = useState<Set<string>>(new Set(user.collections));
  const collectionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();
  const postId = post.id;

  useEffect(() => {
    if (!collectionOpen) return;
    fetch("/api/users/self")
      .then((res) => res.json())
      .then((data) => setCollections(data.collections ?? []))
      .catch(() => {});
  }, [collectionOpen]);

  useEffect(() => {
    if (!collectionOpen) return;
    const handler = (e: MouseEvent) => {
      if (collectionRef.current && !collectionRef.current.contains(e.target as Node)) {
        setCollectionOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [collectionOpen]);

  const handleVote = async (type: VoteType) => {
    if (user.signedIn == false) return;

    const newVote = vote === type ? null : type;
    setVote(newVote);
    setLoading(true);

    await fetch("/api/posts/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, type: newVote }),
    });

    if (newVote == 'DOWNVOTE' && favorited) { await toggleFavorite() };
    if (newVote == 'DOWNVOTE' && boosted) { await boostPost() };

    setLoading(false);
    router.refresh();
  };

  const toggleFavorite = async () => {
    if (user.signedIn == false) return;
    const res = await fetch(`/api/posts/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json();
    setFavorited(data.favorited);

    // If user just favorited AND hasn't upvoted, auto-upvote
    if (data.favorited && vote !== "UPVOTE") {
      await handleVote("UPVOTE");
    }
    router.refresh();
  };

  const boostPost = async () => {
    if (user.signedIn === false) return;
  
    const res = await fetch(`/api/posts/boost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
  
    const data = await res.json();
  
    if (!res.ok) {
      if (res.status == 409) { toast(`You have already boosted today! (Post #${data.lastBoostPost})`, "error"); return; };
      
      console.error("Boost request failed", await res.text());
      return;
    }
  
    // a new boost was created
    if (data.boosted == true) {
      setBoosted(true);
      if (vote == 'DOWNVOTE') { handleVote('DOWNVOTE') }; // remove downvote
    } else if (data.boostedToday == true) {
      toast("You have already boosted today!", "error");
      setBoosted(false);
    } else {
      setBoosted(false);
    }
    router.refresh();
  };

  const addToCollection = async (collectionId: string) => {
    const isIn = checkedCollections.has(collectionId);
    setCheckedCollections((prev) => {
      const next = new Set(prev);
      isIn ? next.delete(collectionId) : next.add(collectionId);
      return next;
    });

    await fetch("/api/collections/self", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        isIn ? { id: collectionId, removePostId: postId } : { id: collectionId, addPostId: postId }
      ),
    });

    router.refresh();
  };

  const filteredCollections = collections
    .filter((c) => c.name.toLowerCase().includes(collectionSearch.toLowerCase()))
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => handleVote("UPVOTE")}
          disabled={loading}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition
            ${vote === "UPVOTE"
              ? "bg-green-400/10 text-green-400 border-secondary-border md:hover:border-zinc-700"
              : "bg-secondary-border text-subtle border-secondary-border md:hover:border-zinc-700"}
          `}
          title={vote ? "Unlike This Post" : "Like This Post"}
        >
          <ThumbsUpIcon size={18} weight={vote === "UPVOTE" ? "fill" : "regular"} />
          Upvote
        </button>

        <button
          onClick={toggleFavorite}
          disabled={loading}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition
            ${favorited
              ? "bg-yellow-400/10 text-yellow-400 border-secondary-border md:hover:border-zinc-700"
              : "bg-secondary-border text-subtle border-secondary-border md:hover:border-zinc-700"}
          `}
          title={favorited ? "Unfavorite This Post" : "Favorite This Post"}
        >
          <StarIcon size={18} weight={favorited ? "fill" : "regular"} />
          Favorite
        </button>

        <button
          onClick={() => handleVote("DOWNVOTE")}
          disabled={loading}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition
            ${vote === "DOWNVOTE"
              ? "bg-red-400/10 text-red-400 border-secondary-border hover:border-zinc-700"
              : "bg-secondary-border text-subtle border-secondary-border hover:border-zinc-700"}
          `}
        >
          <ThumbsDownIcon size={18} weight={vote === "DOWNVOTE" ? "fill" : "regular"} />
          Downvote
        </button>
      </div>

      <div className="flex gap-2 justify-center">
        <button
          onClick={boostPost}
          disabled={loading}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition
            ${boosted
              ? "bg-cyan-400/10 text-cyan-400 border-secondary-border md:hover:border-zinc-700"
              : "bg-secondary-border text-subtle border-secondary-border md:hover:border-zinc-700"}
          `}
          title={boosted ? "Unboost This Post" : "Boost This Post"}
        >
          <SparkleIcon size={18} weight={boosted ? "fill" : "regular"} />
          Boost
        </button>

        <div className="relative" ref={collectionRef}>
          <button
            disabled={loading}
            onClick={() => setCollectionOpen((o) => !o)}
            className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition
              ${checkedCollections.size > 0
                ? "bg-purple-400/10 text-purple-400 border-secondary-border md:hover:border-zinc-700"
                : "bg-secondary-border text-subtle border-secondary-border hover:border-zinc-700"}
            `}
          >
            <BookmarksSimpleIcon size={18} weight={checkedCollections.size > 0 ? "fill" : "regular"} />
            Collection
          </button>

          {collectionOpen && (
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="p-2 border-b border-zinc-800 flex gap-2 overflow-hidden">
                <input
                  type="text"
                  placeholder="Search collections..."
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  className="min-w-0 flex-1 bg-zinc-800 text-sm text-white placeholder-zinc-500 rounded-lg px-3 py-1.5 outline-none focus:ring-1 focus:ring-zinc-600"
                  autoFocus
                />
                <button className="shrink-0 p-1.5 bg-zinc-800 text-zinc-300 rounded-lg border border-zinc-700 hover:border-zinc-500 transition">
                  <PlusIcon size={16} weight="bold" />
                </button>
              </div>
              <ul className="max-h-56 overflow-y-auto">
                {filteredCollections.length === 0 && (
                  <li className="px-3 py-2 text-sm text-zinc-500">No collections found.</li>
                )}
                {filteredCollections.map((col) => (
                  <li key={col.id}>
                    <button
                      onClick={() => addToCollection(col.id)}
                      className="w-full flex items-center justify-between px-3 py-2 text-sm text-white hover:bg-zinc-800 transition"
                    >
                      <span className="truncate mr-2">{col.name}</span>
                      <span className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center pointer-events-none transition
                        ${checkedCollections.has(col.id) ? "bg-amber-600 border-amber-500" : "bg-zinc-800 border-zinc-600"}`}>
                        {checkedCollections.has(col.id) && <CheckIcon size={10} weight="bold" className="text-white" />}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}