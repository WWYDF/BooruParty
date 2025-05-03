"use client";

import { useState } from "react";
import PostVoting from "./PostVoting";
import { resolveFileType } from "@/core/dictionary";
import { Post, PostUserStatus } from "@/core/types/posts";

type Props = {
  post: Post;
  user?: PostUserStatus;
  showVoting?: boolean;
  skeletonAspectRatio?: number;
};

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export default function PostDisplay({ post, user, showVoting = true }: Props) {
  const [showFull, setShowFull] = useState(post.previewScale === 100 || post.previewScale == null);

  const fileType = resolveFileType(`.${post.fileExt}`);

  const fullSrc = `${fastify}/data/uploads/${fileType}/${post.id}.${post.fileExt}`;

  const userNull: PostUserStatus = {
    vote: null,
    favorited: false
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-center">
      {fileType === "video" ? (
        <video
          src={showFull ? fullSrc : post.previewPath}
          controls
          playsInline
          loop
          muted
          preload="metadata"
          className="max-h-[70vh] w-auto h-auto object-contain rounded-xl"
        />
      ) : (
        <img
          loading="lazy"
          src={showFull ? fullSrc : post.previewPath}
          alt={`Error accessing ${fullSrc}`}
          className="max-h-[70vh] w-auto h-auto object-contain rounded-xl"
        />
      )}
      </div>

      {!showFull && post.previewScale !== 100 ? (
        <button
          onClick={() => setShowFull(true)}
          className="text-subtle text-sm italic"
        >
          Viewing sample resized to {post.previewScale}% of original (
          <span className="underline text-accent">view original</span>
          )
        </button>
      ) : null}

      {showVoting && <PostVoting post={post} user={userNull} />}
    </div>
  );
}