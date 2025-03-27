'use client';

import { Posts } from "@prisma/client";
import Link from "next/link";


interface PostCardProps {
  post: Posts;
  viewMode: 'GRID' | 'COLLAGE';
}

export default function PostCard({ post, viewMode }: PostCardProps) {
  const thumbnailSrc = `/thumbnails/image/small_${post.id}.webp`;

  return (
    <Link href={`/post/${post.id}`} className="block group">
      <div className="rounded-xl bg-secondary-border overflow-hidden">
        {viewMode === 'GRID' ? (
          <div className="aspect-square">
            <picture>
              <source
                srcSet={`/thumbnails/image/large_${post.id}.webp`}
                media="(min-width: 1024px)"
              />
              <source
                srcSet={`/thumbnails/image/medium_${post.id}.webp`}
                media="(min-width: 640px)"
              />
              <img
                src={`/thumbnails/image/small_${post.id}.webp`}
                alt={post.fileName}
                className="w-full h-full object-cover"
              />
            </picture>
          </div>
        ) : (
          <picture>
            <source
              srcSet={`/thumbnails/image/large_${post.id}.webp`}
              media="(min-width: 1024px)"
            />
            <source
              srcSet={`/thumbnails/image/medium_${post.id}.webp`}
              media="(min-width: 640px)"
            />
            <img
              src={`/thumbnails/image/small_${post.id}.webp`}
              alt={post.fileName}
              className="w-full object-cover"
            />
          </picture>
        )}


        {/* Metadata like filename and timestamp */}
        <div className="p-2 text-xs text-subtle">
          {post.fileName}
          <br />
          {new Date(post.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}
