"use client";

import { useEffect, useState } from "react";

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
        if (!res.ok) throw new Error("Failed to fetch post.");
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

  if (loading) return <p className="text-subtle p-4">Loading post...</p>;
  if (error) return <p className="text-red-500 p-4">Error: {error}</p>;
  if (!post) return <p className="text-subtle p-4">Post not found.</p>;

  return (
    <main className="p-4 max-w-4xl mx-auto">
      <img
        src={`/uploads/image/${post.fileName}`}
        alt={post.fileName}
        className="w-full max-h-[80vh] object-contain rounded-xl border border-secondary-border"
      />
      <div className="mt-4 text-subtle text-sm space-y-2">
        <p><strong>Uploaded by:</strong> {post.uploadedBy}</p>
        <p><strong>Tags:</strong> {post.tags.join(", ")}</p>
        <p><strong>Safety:</strong> {post.safety}</p>
        <p><strong>Notes:</strong> {post.notes || "None"}</p>
        <p><strong>Uploaded on:</strong> {new Date(post.createdAt).toLocaleString()}</p>
      </div>
    </main>
  );
}
