"use client";

import { useEffect, useState } from "react";

type RawComment = {
  id: number;
  postId: number;
  authorId: string;
  content: string;
  createdAt: string;
};

type ResolvedComment = RawComment & {
  authorName: string;
};

type Props = {
  postId: number;
};

export default function PostComments({ postId }: Props) {
  const [comments, setComments] = useState<ResolvedComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/comments?postId=${postId}`);
        if (!res.ok) throw new Error("Failed to fetch comments");
        const rawComments: RawComment[] = await res.json();

        // Cache for authorId → name
        const userCache: Record<string, string> = {};

        const resolved: ResolvedComment[] = await Promise.all(
          rawComments.map(async (comment) => {
            if (!userCache[comment.authorId]) {
              const userRes = await fetch(`/api/users/${comment.authorId}`);
              const userData = await userRes.json();
              userCache[comment.authorId] = userData?.username ?? "Unknown";
            }

            return {
              ...comment,
              authorName: userCache[comment.authorId],
            };
          })
        );

        setComments(resolved);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [postId]);

  return (
    <section className="border-t border-secondary-border pt-4 space-y-4">
      <h2 className="text-accent text-lg">Comments</h2>

      {loading && <p className="text-subtle text-sm">Loading comments...</p>}
      {error && <p className="text-red-500 text-sm">Error: {error}</p>}

      {!loading && comments.length === 0 && (
        <p className="text-subtle text-sm italic">No comments yet.</p>
      )}

      <div className="space-y-3">
        {comments.map((comment) => (
          <div
            key={comment.id}
            className="bg-secondary-border p-3 rounded-xl text-sm text-subtle"
          >
            <div className="text-xs text-muted mb-1">
              {comment.authorName} ·{" "}
              {new Date(comment.createdAt).toLocaleString()}
            </div>
            <p>{comment.content}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
