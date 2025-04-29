'use client';
import { useState, useEffect } from "react";
import EditPost from "./EditPost";
import { PencilSimple, Tag } from "@phosphor-icons/react";

import Image from "next/image";
import Link from "next/link";

const AVATAR_URL = "/user.png";

export type Props = {
  post: {
    id: number;
    anonymous: boolean;
    safety: string;
    sources: string[];
    notes: string | null;
    createdAt: string;
    score: number;
    postTags: {
      tag: {
        name: string;
        parentTag: {
          category: {
            name: string;
            color: string;
          };
        };
      };
    }[];
  };
  uploader: {
    id: string;
    username: string;
    avatar: string;
  } | null;
};

export default function PostMetadata({ post, uploader }: Props) {
  const [editing, setEditing] = useState(false);
  const [tagGroups, setTagGroups] = useState<Record<string, { name: string; color: string }[]>>({});

  const displayName = post.anonymous ? "Anonymous" : uploader?.username;
  const displayAvatar = post.anonymous ? AVATAR_URL : uploader?.avatar || AVATAR_URL;

  return (
    <div className="flex flex-col gap-4 text-sm text-subtle">
      <div className="flex items-center gap-3">
        {displayAvatar ? (
          <Image
            src={displayAvatar}
            alt="Uploader avatar"
            width={48}
            height={48}
            className="rounded-full border border-secondary-border"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-secondary-border animate-pulse" />
        )}
        <div className="flex-1">
          <p className="text-base text-white font-semibold">{displayName}</p>
          <p className="text-xs text-subtle">{new Date(post.createdAt).toLocaleString()}</p>
        </div>

        {editing ? (
          <button
            onClick={() => setEditing(false)}
            className="text-sm text-white bg-secondary-border px-3 py-1 rounded hover:bg-accent hover:text-black"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-subtle hover:text-accent text-sm flex items-center gap-1"
          >
            <PencilSimple size={16} /> Edit post
          </button>
        )}
      </div>

      {editing ? (
        <EditPost post={post} onSuccess={() => location.reload()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
            <p><span className="text-white font-medium">Safety:</span> {post.safety}</p>
            <p><span className="text-white font-medium">Score:</span> {post.score}</p>
            <p className="col-span-2">
              <span className="text-white font-medium">Sources:</span>{" "}
              {post.sources.length ? (
                <span className="flex flex-wrap gap-2">
                  {post.sources.map((src, i) => (
                    <Link key={i} href={src} target="_blank" className="text-accent underline break-all">
                      {src}
                    </Link>
                  ))}
                </span>
              ) : "None"}
            </p>
            <p className="col-span-2">
              <span className="text-white font-medium">Notes:</span>{" "}
              {post.notes || "None"}
            </p>
          </div>

          {Object.keys(tagGroups).length > 0 && (
            <div className="flex flex-col gap-4 mt-2">
              {Object.entries(tagGroups).map(([category, tags]) => (
                <div key={category}>
                  <p className="text-white text-sm font-medium mb-1">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                      <Link
                        key={i}
                        href={`/dashboard/tags/${tag.name}`}
                        className="flex items-center gap-1 text-sm border border-secondary-border px-2 py-1 rounded-full hover:opacity-90"
                        style={{ color: tag.color }}
                      >
                        <Tag size={14} /> {tag.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}