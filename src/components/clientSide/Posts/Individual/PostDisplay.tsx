"use client";

import { useState } from "react";
import PostVoting from "./PostVoting";

type Props = {
  post: {
    id: number;
    fileName: string;
    createdAt: string;
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
      {!showFull && (
        <button
          onClick={() => setShowFull(true)}
          className="text-accent text-sm underline"
        >
          View Full File
        </button>
      )}

      <PostVoting postId={post.id} />
    </div>
  );
}
