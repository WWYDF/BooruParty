"use client";

import { useEffect, useState } from "react";
import PostDisplay from "./PostDisplay";
import PostMetadata from "./PostMetadata";
import PostCommentForm from "./PostCommentForm";
import PostCommentList from "./PostCommentList";

type Post = {
  id: number;
  fileName: string;
  uploadedBy: string;
  anonymous: boolean;
  safety: string;
  tags: string[];
  sources: string[];
  notes: string | null;
  flags: string[];
  createdAt: string;
};

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

export default function PostPageClient({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [comments, setComments] = useState<ResolvedComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Fetch post
  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${postId}`);
        if (!res.ok) throw new Error("Failed to fetch post");
        const data = await res.json();
        setPost(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [postId]);

  // Fetch comments
  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      setCommentError(null);

      const res = await fetch(`/api/comments?postId=${postId}`);
      if (!res.ok) throw new Error("Failed to fetch comments");
      const rawComments: RawComment[] = await res.json();

      const userCache: Record<string, string> = {};
      const resolved = await Promise.all(
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
      setCommentError((err as Error).message);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [postId]);

  if (loading) return <p className="p-4 text-subtle">Loading post...</p>;
  if (error || !post) return <p className="p-4 text-red-500">Error loading post</p>;

  return (
    <main className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6 p-4">
      <PostMetadata post={post} />
      <div className="space-y-4">
        <PostDisplay post={post} />
        <section className="border-t border-secondary-border pt-4 space-y-4">
          <h2 className="text-accent text-lg">Comments</h2>
          <PostCommentForm postId={post.id} onPosted={fetchComments} />
          <PostCommentList
            comments={comments}
            loading={loadingComments}
            error={commentError}
          />
        </section>
      </div>
    </main>
  );
}
