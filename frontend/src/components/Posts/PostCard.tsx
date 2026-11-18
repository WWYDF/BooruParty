'use client';

import { Posts } from "@/core/types/posts";
import { ChatsIcon, FilmStripIcon, HeartIcon, SparkleIcon, ThumbsUpIcon } from "@phosphor-icons/react";
import Link from "next/link";

interface PostCardProps {
  post: Posts;
  viewMode: 'GRID' | 'COLLAGE';
  selectionMode?: boolean;
  isSelected?: boolean;
  toggleSelect?: (postId: number, e: React.MouseEvent) => void;
}

export default function PostCard({ post, viewMode, selectionMode, isSelected, toggleSelect }: PostCardProps) {
  const isAnimated = post.type !== 'IMAGE';

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
              <source srcSet={post.thumbnails.large} media="(min-width: 1280px)" />
              <source srcSet={post.thumbnails.med} media="(min-width: 768px)" />
              <img
                srcSet={post.thumbnails.small}
                alt={post.id.toString()}
                className="w-full h-full object-cover"
              />
            </picture>
          </div>
        ) : (
          <picture>
            <source srcSet={post.thumbnails.large} media="(min-width: 1280px)" />
            <source srcSet={post.thumbnails.med} media="(min-width: 768px)" />
            <img
              srcSet={post.thumbnails.small}
              alt={post.id.toString()}
              className="w-full object-cover"
            />
          </picture>
        )}

        {/* Floating Icons */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          {isAnimated && (
            <div className="bg-secondary-border px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <FilmStripIcon size={16} />
            </div>
          )}
        </div>

        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          {post.commentCount > 0 && (
            <div className="bg-secondary-border/70 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <ChatsIcon size={16} className="text-yellow-500" weight="bold" />
              <span>{post.commentCount}</span>
            </div>
          )}

          {post.score > 0 && (
            <div className="bg-secondary-border/70 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <ThumbsUpIcon size={16} className="text-green-500" weight={post.viewer?.vote == 1 ? 'fill' : 'bold'} />
              <span>{post.score}</span>
            </div>
          )}

          {post.favoriteCount > 0 && (
            <div className="bg-secondary-border/70 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <HeartIcon size={16} className="text-red-500" weight={post.viewer?.favorited ? 'fill' : 'bold'} />
              <span>{post.favoriteCount}</span>
            </div>
          )}

          {/* {post._count?.boosts > 0 && (
            <div className="bg-secondary-border/70 px-2 py-1 rounded-full text-xs flex items-center gap-1">
              <SparkleIcon size={16} className="text-cyan-500" weight="bold" />
              <span>{post._count?.boosts}</span>
            </div>
          )} */}
        </div>
      </div>
    </Link>
  );
}
