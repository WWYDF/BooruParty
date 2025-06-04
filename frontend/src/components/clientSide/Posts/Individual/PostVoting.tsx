'use client'
import { ThumbsUp, ThumbsDown, Star } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PostUserStatus } from "@/core/types/posts";

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
  const [loading, setLoading] = useState(false);
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
        title={favorited ? "Unfavorite" : "Favorite"}
      >
        <Star size={18} weight={favorited ? "fill" : "regular"} />
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
        <ThumbsDown size={18} weight={vote === "DOWNVOTE" ? "fill" : "regular"} />
        Downvote
      </button>
    </div>
  );
}