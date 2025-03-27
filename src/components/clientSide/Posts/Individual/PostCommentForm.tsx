"use client";

import { useSession } from "next-auth/react";
import { useState } from "react";
import { RawComment, ResolvedComment } from "@/core/types/comments";


type Props = {
  postId: number;
  onPosted: (comment: ResolvedComment) => void;
};

export default function PostCommentForm({ postId, onPosted }: Props) {
  const { data: session, status } = useSession();
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);

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

    const tempId = Date.now(); // fake ID for optimistic UI

    const tempComment: ResolvedComment = {
      id: tempId,
      postId,
      content,
      createdAt: new Date().toISOString(),
      authorId: session?.user?.id ?? "temp-user",
      authorName: session?.user?.username ?? "You",
    };

    onPosted(tempComment); // ⬅️ tell the parent to add the fake comment
    setContent("");

    setPosting(true);
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, content }),
    });

    if (!res.ok) {
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
            className="flex-1 p-2 rounded bg-zinc-900 text-subtle text-sm resize-y min-h-[2.5rem]"
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
