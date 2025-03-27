"use client";

import { useState } from "react";
import PostVoting from "./PostVoting";

type Props = {
  post: {
    id: number;
    fileName: string;
    createdAt: string;
    previewScale: number;
  };
};

export default function PostDisplay({ post }: Props) {
  const [showFull, setShowFull] = useState(false);

  const extension = post.fileName.split(".").pop();
  const previewSrc = `/previews/${post.fileName.replace(`.${extension}`, ".webp")}`;
  const fullSrc = `/uploads/image/${post.fileName}`;

  return (
    <div className="flex flex-col items-center gap-4">
      <img
        src={showFull ? fullSrc : previewSrc}
        alt={post.fileName}
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
