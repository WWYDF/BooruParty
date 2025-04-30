"use client";

import { useState } from "react";
import PostVoting from "./PostVoting";
import { resolveFileType } from "@/core/dictionary";

type Props = {
  post: {
    id: number;
    fileExt: string;
    createdAt: string;
    previewScale: number;
    score: number;
    favorites?: number;
  };
  showVoting?: boolean;
};

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export default function PostDisplay({ post, showVoting = true }: Props) {
  const [showFull, setShowFull] = useState(post.previewScale === 100 || post.previewScale == null);

  const fileType = resolveFileType(`.${post.fileExt}`);

  const previewExt = fileType === "animated" ? "gif" : "webp";
  const previewSrc = `${fastify}/data/previews/${fileType}/${post.id}.${previewExt}`;
  const fullSrc = `${fastify}/data/uploads/${fileType}/${post.id}.${post.fileExt}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-center">
        <img
          loading="lazy"
          src={showFull ? fullSrc : previewSrc}
          alt={`Error accessing ${fullSrc}`}
          className="max-h-[70vh] w-auto h-auto object-contain rounded-xl"
        />
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

      {showVoting && <PostVoting post={post} />}
    </div>
  );
}