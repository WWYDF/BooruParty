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

  const previewSrc = `${fastify}/previews/${post.id}.webp`;
  const fullSrc = `${fastify}/uploads/image/${post.id}.${post.fileExt}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src={showFull ? fullSrc : previewSrc}
        alt='Post'
        className="max-h-[80vh] w-auto rounded-xl border border-secondary-border object-contain"
      />
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
