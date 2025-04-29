"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  postId: number;
};

export default function PostCommentForm({ postId }: Props) {
  const { data: session, status } = useSession();
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const router = useRouter();

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    return (
      <p className="text-sm text-subtle italic">
        You must be logged in to comment.
      </p>
    );
  }

  const handlePost = async () => {
    if (!content.trim()) return;

    setPosting(true);

    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, content }),
    });

    if (res.ok) {
      setContent(""); // Clear input after successful post
      // You could add a "toast" or "reload comments" here later if you want
      router.refresh();
    } else {
      alert("Failed to post comment.");
    }

    setPosting(false);
  };

  return (
    <div className="flex items-end gap-2">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={1}
        className="flex-1 p-2 rounded bg-zinc-900 text-subtle text-sm resize-y min-h-[2.5rem] focus:outline-none focus:ring-2 focus:ring-zinc-600"
        placeholder="Write a comment..."
      />
      <button
        disabled={!content.trim() || posting}
        onClick={handlePost}
        className="bg-accent text-white text-sm px-4 py-1.5 rounded-xl disabled:opacity-50"
      >
        {posting ? "Posting..." : "Post"}
      </button>
    </div>
  );
}
