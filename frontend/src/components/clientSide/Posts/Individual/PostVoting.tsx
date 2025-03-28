import { ThumbsUp, ThumbsDown, Star } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type VoteType = "UPVOTE" | "DOWNVOTE" | null;

export default function PostVoting({ postId }: { postId: number }) {
  const { data: session } = useSession();
  const [vote, setVote] = useState<VoteType>(null);
  const [favorited, setFavorited] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!session) return;

      const voteRes = await fetch(`/api/posts/vote?postId=${postId}`);
      if (voteRes.ok) {
        const data = await voteRes.json();
        setVote(data.type ?? null);
      }

      const favRes = await fetch(`/api/posts/favorite?postId=${postId}`);
      if (favRes.ok) {
        const data = await favRes.json();
        setFavorited(data.favorited);
      }
    };

    fetchStatus();
  }, [postId, session]);

  const handleVote = async (type: VoteType) => {
    if (!session) return;

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
    if (!session) return;
    const res = await fetch(`/api/posts/favorite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json();
    setFavorited(data.favorited);
  };

  return (
    <div className="flex gap-2">
      <button
        onClick={() => handleVote("UPVOTE")}
        disabled={loading}
        className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm border transition 
          ${vote === "UPVOTE"
            ? "bg-accent/10 text-accent border-accent"
            : "bg-secondary-border text-subtle border-secondary-border hover:border-accent"}
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
            ? "bg-yellow-400/10 text-yellow-400 border-yellow-400"
            : "bg-secondary-border text-subtle border-secondary-border hover:border-yellow-400"}
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
            ? "bg-accent/10 text-accent border-accent"
            : "bg-secondary-border text-subtle border-secondary-border hover:border-accent"}
        `}
      >
        <ThumbsDown size={18} weight={vote === "DOWNVOTE" ? "fill" : "regular"} />
        Downvote
      </button>
    </div>
  );
}