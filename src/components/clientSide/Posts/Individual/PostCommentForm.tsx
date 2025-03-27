"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";

export default function PostCommentForm({ postId, onPosted }: { postId: number; onPosted: () => void }) {
  const { data: session, status } = useSession();
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = async () => {
    if (!content.trim()) return;

    setPosting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, content }),
    });

    if (res.ok) {
      setContent("");
      onPosted(); // trigger comment list refresh
    } else {
      alert("Failed to post comment.");
    }
    setPosting(false);
  };

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    return <p className="text-sm text-subtle italic">You must be logged in to comment.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full p-2 rounded bg-secondary-border text-subtle text-sm"
        placeholder="Write a comment..."
        rows={3}
      />
      <div className="flex justify-end">
        <button
          disabled={!content.trim() || posting}
          onClick={handlePost}
          className="bg-accent text-white text-sm px-4 py-1.5 rounded-xl disabled:opacity-50"
        >
          {posting ? "Posting..." : "Post"}
        </button>
      </div>
    </div>
  );
}
