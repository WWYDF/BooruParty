"use client";

import { useState } from "react";

type Comment = {
  id: number;
  author: string;
  message: string;
  createdAt: string;
};

type Props = {
  postId: number;
};

export default function PostComments({ postId }: Props) {
  // Placeholder comments for now
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  const handlePost = () => {
    // Logic will be added later
    setPosting(true);
    setTimeout(() => {
      setComments((prev) => [
        {
          id: Date.now(),
          author: "You",
          message: newComment,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNewComment("");
      setPosting(false);
    }, 600);
  };

  return (
    <section className="border-t border-secondary-border pt-4 space-y-4">
      <h2 className="text-accent text-lg">Comments</h2>

      <div className="flex flex-col gap-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          className="w-full p-2 rounded bg-secondary-border text-subtle text-sm"
          placeholder="Write a comment..."
          rows={3}
        />
        <div className="flex justify-end">
          <button
            disabled={!newComment.trim() || posting}
            onClick={handlePost}
            className="bg-accent text-white text-sm px-4 py-1.5 rounded-xl disabled:opacity-50"
          >
            {posting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-subtle text-sm italic">No comments yet.</p>
        )}

        {comments.map((comment) => (
          <div
            key={comment.id}
            className="bg-secondary-border p-3 rounded-xl text-sm text-subtle"
          >
            <div className="text-xs text-muted mb-1">
              {comment.author} · {new Date(comment.createdAt).toLocaleString()}
            </div>
            <p>{comment.message}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
