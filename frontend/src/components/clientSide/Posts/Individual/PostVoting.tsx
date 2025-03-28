import { ThumbsUp, ThumbsDown } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

type VoteType = "UPVOTE" | "DOWNVOTE" | null;

export default function PostVoting({ postId }: { postId: number }) {
  const { data: session } = useSession();
  const [vote, setVote] = useState<VoteType>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchVote = async () => {
      if (!session) return;
      const res = await fetch(`/api/posts/vote?postId=${postId}`);
      if (res.ok) {
        const data = await res.json();
        setVote(data.type ?? null);
      }
    };

    fetchVote();
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
