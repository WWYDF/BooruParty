"use client";

import { useState } from "react";
import PostVoting from "./PostVoting";

type Props = {
  post: {
    id: number;
    fileExt: string;
    createdAt: string;
    previewScale: number;
  };
};

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export default function PostDisplay({ post }: Props) {
  const [showFull, setShowFull] = useState(false);

  const previewSrc = `${fastify}/data/previews/image/${post.id}.webp`;
  const fullSrc = `${fastify}/data/uploads/image/${post.id}.${post.fileExt}`;

  // fallback to 75% scale if previewScale is missing
  const scale = post.previewScale || 75;
  const paddingTop = `${scale}%`; // this assumes previewScale is height/width * 100

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-full max-w-5xl" style={{ paddingTop }}>
        <img
          loading="lazy"
          src={showFull ? fullSrc : previewSrc}
          alt="Post"
          className="absolute top-0 left-0 w-full h-full rounded-xl object-contain"
        />
      </div>

      {!showFull && post.previewScale ? (
        <button
          onClick={() => setShowFull(true)}
          className="text-subtle text-sm italic"
        >
          Viewing sample resized to {post.previewScale}% of original (
          <span className="underline text-accent">view original</span>
          )
        </button>
      ) : null}

      <PostVoting postId={post.id} />
    </div>
  );
}
