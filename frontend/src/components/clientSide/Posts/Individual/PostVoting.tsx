'use client'
import { ThumbsUp, ThumbsDown, Star, Sparkle } from "@phosphor-icons/react";
import { useState } from "react";
import { PostUserStatus } from "@/core/types/posts";
import { useToast } from "../../Toast";

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
  const toast = useToast();
  const postId = post.id;

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

    setLoading(false);
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
    } else if (data.boostedToday == true) {
      toast("You have already boosted today!", "error");
      setBoosted(false);
    } else {
      setBoosted(false);
    }
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleVote("UPVOTE")}
        disabled={loading}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition 
          ${vote === "UPVOTE"
            ? "bg-green-400/10 text-green-400 border-secondary-border hover:border-zinc-700"
            : "bg-secondary-border text-subtle border-secondary-border hover:border-zinc-700"}
        `}
        title={vote ? "Unlike This Post" : "Like This Post"}
      >
        <ThumbsUp size={18} weight={vote === "UPVOTE" ? "fill" : "regular"} />
        Upvote
      </button>

      <button
        onClick={toggleFavorite}
        disabled={loading}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition 
          ${favorited
            ? "bg-yellow-400/10 text-yellow-400 border-secondary-border hover:border-zinc-700"
            : "bg-secondary-border text-subtle border-secondary-border hover:border-zinc-700"}
        `}
        title={favorited ? "Unfavorite This Post" : "Favorite This Post"}
      >
        <Star size={18} weight={favorited ? "fill" : "regular"} />
        Favorite
      </button>

      <button
        onClick={boostPost}
        disabled={loading}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition 
          ${boosted
            ? "bg-cyan-400/10 text-cyan-400 border-secondary-border hover:border-zinc-700"
            : "bg-secondary-border text-subtle border-secondary-border hover:border-zinc-700"}
        `}
        title={boosted ? "Unboost This Post" : "Boost This Post"}
      >
        <Sparkle size={18} weight={boosted ? "fill" : "regular"} />
        Boost
      </button>
    </div>
  );
}