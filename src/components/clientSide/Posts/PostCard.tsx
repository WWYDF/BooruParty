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
      <picture>
        <source
          media="(min-width: 1024px)"
          srcSet={`/thumbnails/image/large_${post.id}.webp`}
        />
        <source
          media="(min-width: 640px)"
          srcSet={`/thumbnails/image/medium_${post.id}.webp`}
        />
        <img
          src={`/thumbnails/image/small_${post.id}.webp`}
          alt={post.fileName}
          className="w-full h-auto object-cover rounded-xl"
        />
      </picture>
        <div className="p-2 text-xs text-subtle">
          <p>{post.fileName}</p>
          <p>{new Date(post.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </Link>
  );
}
