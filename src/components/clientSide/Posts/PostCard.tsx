"use client";

import Link from "next/link";

type PostCardProps = {
  post: {
    id: number;
    fileName: string;
    createdAt: string;
  };
};

export default function PostCard({ post }: PostCardProps) {
  const imageUrl = `/uploads/image/${post.fileName}`;

  return (
    <Link href={`/post/${post.id}`}>
      <div className="cursor-pointer rounded-xl overflow-hidden bg-secondary-border shadow hover:scale-[1.02] transition-transform">
        <img
          src={imageUrl}
          alt={post.fileName}
          className="w-full h-48 object-cover"
        />
        <div className="p-2 text-xs text-subtle">
          <p>{post.fileName}</p>
          <p>{new Date(post.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </Link>
  );
}
