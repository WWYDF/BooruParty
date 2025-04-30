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
  const [showFull, setShowFull] = useState(post.previewScale === 100 || post.previewScale == null);

  const previewSrc = `${fastify}/data/previews/image/${post.id}.webp`;
  const fullSrc = `${fastify}/data/uploads/image/${post.id}.${post.fileExt}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex justify-center">
        <img
          loading="lazy"
          src={showFull ? fullSrc : previewSrc}
          alt="Post"
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

      <PostVoting postId={post.id} />
    </div>
  );
}