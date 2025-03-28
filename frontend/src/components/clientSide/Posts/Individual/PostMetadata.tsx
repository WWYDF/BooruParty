'use client';
import { useState } from "react";
import EditPostModal from "./EditPost";
import { AnimatePresence } from "framer-motion";
import { PencilSimple } from "@phosphor-icons/react";

import Image from "next/image";

// Placeholder avatar (replace with real one later)
const AVATAR_URL = "https://placehold.co/48x48";

export type Props = {
  post: {
    id: number;
    uploadedBy: string;
    anonymous: boolean;
    safety: string;
    tags: string[];
    sources: string[];
    notes: string | null;
    createdAt: string;
    score: number;
  };
};

export default function PostMetadata({ post }: Props) {
  const [editing, setEditing] = useState(false);
  const uploaderDisplay = post.anonymous ? "Anonymous" : post.uploadedBy;

  return (
    <div className="flex flex-col gap-4 text-sm text-subtle">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src={AVATAR_URL}
            alt="Uploader avatar"
            width={36}
            height={36}
            className="rounded-full border border-secondary-border"
          />
          <div>
            <p className="text-base text-white font-semibold">{uploaderDisplay}</p>
            <p className="text-xs text-subtle">
              {new Date(post.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-subtle hover:text-accent text-sm flex items-center gap-1"
        >
          <PencilSimple size={16} /> Edit
        </button>
      </div>

      <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
        <p><span className="text-white font-medium">Safety:</span> {post.safety}</p>
        <p><span className="text-white font-medium">Score:</span> {post.score}</p>
        <p className="col-span-2">
          <span className="text-white font-medium">Sources:</span>{" "}
          {post.sources.length ? post.sources.join(", ") : "None"}
        </p>
        <p className="col-span-2">
          <span className="text-white font-medium">Notes:</span>{" "}
          {post.notes || "None"}
        </p>
      </div>

      <AnimatePresence>
        {editing && (
          <EditPostModal
            post={post}
            onClose={() => setEditing(false)}
            onSuccess={() => location.reload()}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
