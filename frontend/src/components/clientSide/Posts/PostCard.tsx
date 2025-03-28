'use client';

import { Posts } from "@prisma/client";
import Link from "next/link";


interface PostCardProps {
  post: Posts;
  viewMode: 'GRID' | 'COLLAGE';
}

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export default function PostCard({ post, viewMode }: PostCardProps) {
  const thumbnailUrl = `${fastify}/thumbnails/${post.id}`;

  return (
    <Link href={`/post/${post.id}`} className="block group">
      <div className="rounded-xl bg-secondary-border overflow-hidden">
        {viewMode === 'GRID' ? (
          <div className="aspect-square">
            <picture>
              <source
                srcSet={`${thumbnailUrl}_large.webp`}
                media="(min-width: 1024px)"
              />
              <source
                srcSet={`${thumbnailUrl}_med.webp`}
                media="(min-width: 640px)"
              />
              <img
                srcSet={`${thumbnailUrl}_small.webp`}
                alt={post.id.toString()}
                className="w-full h-full object-cover"
              />
            </picture>
          </div>
        ) : (
          <picture>
            <source
              srcSet={`${thumbnailUrl}_large.webp`}
              media="(min-width: 1024px)"
            />
            <source
              srcSet={`${thumbnailUrl}_med.webp`}
              media="(min-width: 640px)"
            />
            <img
              srcSet={`${thumbnailUrl}_small.webp`}
              alt={post.id.toString()}
              className="w-full object-cover"
            />
          </picture>
        )}


        {/* Metadata like filename and timestamp */}
        <div className="p-2 text-xs text-subtle">
          Post: {post.id.toString()}
          <br />
          {new Date(post.createdAt).toLocaleDateString()}
        </div>
      </div>
    </Link>
  );
}
