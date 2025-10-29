'use client';

import { Post } from "@/core/types/posts";
import Link from "next/link";
import { ThumbsUp, Heart, FilmStrip, Chats, Sparkle } from "phosphor-react";

interface PostCardProps {
  post: Post;
  viewMode: 'GRID' | 'COLLAGE';
  selectionMode?: boolean;
  isSelected?: boolean;
  toggleSelect?: (postId: number, e: React.MouseEvent) => void;
}

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export default function PostCard({ post, viewMode, selectionMode, isSelected, toggleSelect }: PostCardProps) {
  const thumbnailUrl = `${fastify}/data/thumbnails/${post.id}`;
  // Assume post.fileExt tells us if it's a gif or video
  const isAnimated = post.fileExt === "gif" || post.fileExt === "mp4" || post.fileExt === "webm";

  const liked = post.votes.some(v => v.type === 'UPVOTE');
  const faved = post.favoritedBy.length > 0;

  console.log(`Post #${post.id}: (Liked: ${liked} [${post.votes[0]}]) (Faved: ${faved})`);
  return (
    <Link
      href={selectionMode ? "#" : `/post/${post.id}`}
      onClick={(e) => {
        sessionStorage.setItem("scrollY", window.scrollY.toString());
        if (selectionMode) {
          e.preventDefault();
          toggleSelect?.(post.id, e);
        }
      }}
      className="block group relative"
    >
      {/* Mass Editing */}
      {selectionMode && (
        <div className="absolute top-2 right-2 z-20">
          <div
            className={`w-5 h-5 border-2 rounded-sm flex items-center justify-center cursor-pointer transition ${
              isSelected
                ? "bg-green-600 border-green-400"
                : "bg-zinc-800 border-zinc-600"
            }`}
          >
            {isSelected && <div className="w-2 h-2 bg-white rounded-sm" />}
          </div>
        </div>
      )}

      <div className="rounded-xl bg-secondary overflow-hidden relative transform transition duration-200 md:hover:-translate-y-1.5 hover:shadow-lg hover:shadow-black/30">
        {viewMode === 'GRID' ? (
          <div className="aspect-square">
            <picture>
              {/* <source srcSet={`${thumbnailUrl}_large.webp`} media="(min-width: 1920px)" /> */}
              <source srcSet={`${thumbnailUrl}_med.webp`} media="(min-width: 1024px)" />
              <img
                srcSet={`${thumbnailUrl}_small.webp`}
                alt={post.id.toString()}
                className="w-full h-full object-cover"
              />
            </picture>
          </div>
        ) : (
          <picture>
            {/* <source srcSet={`${thumbnailUrl}_large.webp`} media="(min-width: 1920px)" /> */}
            <source srcSet={`${thumbnailUrl}_med.webp`} media="(min-width: 1024px)" />
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
          {post.comments?.length > 0 && (
            <div className="bg-secondary-border/70 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <Chats size={16} className="text-yellow-500" weight="bold" />
              <span>{post.comments.length}</span>
            </div>
          )}

          {post.score > 0 && (
            <div className="bg-secondary-border/70 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <ThumbsUp size={16} className="text-green-500" weight={liked ? 'fill' : 'bold'} />
              <span>{post.score}</span>
            </div>
          )}

          {post._count?.favoritedBy > 0 && (
            <div className="bg-secondary-border/70 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <Heart size={16} className="text-red-500" weight={faved ? 'fill' : 'bold'} />
              <span>{post._count?.favoritedBy}</span>
            </div>
          )}

          {post._count?.boosts > 0 && (
            <div className="bg-secondary-border/70 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <Sparkle size={16} className="text-cyan-500" weight="bold" />
              <span>{post._count?.boosts}</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
