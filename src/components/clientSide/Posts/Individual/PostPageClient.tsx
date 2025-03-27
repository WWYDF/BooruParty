"use client";

import { useEffect, useState } from "react";
import PostMetadata from "./PostMetadata";
import PostDisplay from "./PostDisplay";
import PostComments from "./PostComments";

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

export default function PostPageClient({ postId }: { postId: string }) {
  const [post, setPost] = useState<Post | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <p className="p-4 text-subtle">Loading post...</p>;
  if (error || !post) return <p className="p-4 text-red-500">Error loading post</p>;

  return (
    <main className="grid grid-cols-1 md:grid-cols-[350px_1fr] gap-6 p-4">
      <PostMetadata post={post} />
      <div className="space-y-4">
        <PostDisplay post={post} />
        <PostComments postId={post.id} />
      </div>
    </main>
  );
}
