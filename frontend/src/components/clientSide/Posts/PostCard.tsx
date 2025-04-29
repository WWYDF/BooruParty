'use client';

import Link from "next/link";
import { ThumbsUp, Heart, FilmStrip } from "phosphor-react"; // ✅ icons
import { Post } from "../../../../types/posts";

interface PostCardProps {
  post: Post;
  viewMode: 'GRID' | 'COLLAGE';
}

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export default function PostCard({ post, viewMode }: PostCardProps) {
  const thumbnailUrl = `${fastify}/data/thumbnails/${post.id}`;

  // Assume post.fileExt tells us if it's a gif or video
  const isAnimated = post.fileExt === "gif" || post.fileExt === "mp4" || post.fileExt === "webm";

  return (
    <Link href={`/post/${post.id}`} className="block group relative">
      <div className="rounded-xl bg-secondary-border overflow-hidden relative">
        {viewMode === 'GRID' ? (
          <div className="aspect-square">
            <picture>
              <source srcSet={`${thumbnailUrl}_large.webp`} media="(min-width: 1024px)" />
              <source srcSet={`${thumbnailUrl}_med.webp`} media="(min-width: 640px)" />
              <img
                srcSet={`${thumbnailUrl}_small.webp`}
                alt={post.id.toString()}
                className="w-full h-full object-cover"
              />
            </picture>
          </div>
        ) : (
          <picture>
            <source srcSet={`${thumbnailUrl}_large.webp`} media="(min-width: 1024px)" />
            <source srcSet={`${thumbnailUrl}_med.webp`} media="(min-width: 640px)" />
            <img
              srcSet={`${thumbnailUrl}_small.webp`}
              alt={post.id.toString()}
              className="w-full object-cover"
            />
          </picture>
        )}

        {/* Floating Icons */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          {isAnimated && (
            <div className="bg-secondary-border px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <FilmStrip size={16} />
            </div>
          )}
        </div>

        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <div className="bg-secondary-border px-2 py-1 rounded-full text-xs flex items-center gap-1">
            <ThumbsUp size={16} />
            <span>{post.score}</span>
          </div>
          <div className="bg-secondary-border px-2 py-1 rounded-full text-xs flex items-center gap-1">
            <Heart size={16} />
            <span>{post.favoritedBy?.length ?? 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
