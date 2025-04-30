"use client";

import { useState } from "react";
import EditPost from "./EditPost";
import { PencilSimple, Tag as TagIcon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FloppyDisk, Heart, Minus, Plus, Tag, ThumbsUp } from "phosphor-react";
import { formatStorageFromBytes } from "@/core/formats";
import { FILE_TYPE_LABELS } from "@/core/dictionary";

const AVATAR_URL = "/user.png";

type Props = {
  post: {
    id: number;
    anonymous: boolean;
    fileExt: string;
    safety: "SAFE" | "SKETCHY" | "UNSAFE";
    sources: string[];
    notes: string | null;
    createdAt: string;
    score: number;
    tags: {
      id: number;
      name: string;
      category: {
        id: number;
        name: string;
        color: string;
      };
      aliases: {
        id: number;
        alias: string;
      }[];
    }[];
    uploadedBy: {
      id: string;
      username: string;
      role: string;
      avatar: string;
    },
    fileSize?: number;
    favorites?: number;
  };
};


export default function PostMetadata({ post }: Props) {
  const [editing, setEditing] = useState(false);
  const router = useRouter();

  function modifyQuery(action: "replace" | "add" | "exclude", tag: string) {
    const saved = JSON.parse(localStorage.getItem("lastSearchParams") ?? "{}");
    const prevQuery = saved.query ?? "";

    let newQuery = "";

    if (action === "replace") {
      newQuery = tag;
    } else if (action === "add") {
      const parts = prevQuery.split(/\s+/).filter(Boolean);
      if (!parts.includes(tag)) parts.push(tag);
      newQuery = parts.join(" ");
    } else {
      const parts = prevQuery.split(/\s+/).filter(Boolean);
      if (!parts.includes(`-${tag}`)) parts.push(`-${tag}`);
      newQuery = parts.join(" ");
    }

    localStorage.setItem("lastSearchParams", JSON.stringify({
      ...saved,
      query: newQuery
    }));

    router.push(`/posts?query=${encodeURIComponent(newQuery)}`);
  }

  const displayName = post.anonymous ? "Anonymous" : post.uploadedBy?.username;
  const displayAvatar = post.anonymous ? AVATAR_URL : post.uploadedBy?.avatar || AVATAR_URL;

  return (
    <div className="flex flex-col gap-4 text-sm text-subtle">
      {/* Header with user info */}
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
          <p className="text-base text-white font-semibold flex items-center gap-2">
            {displayName}
            {!post.anonymous && post.uploadedBy.role === "Admin" && (
              <span className="bg-red-500/10 text-red-400 text-xs font-medium px-2 py-0.5 rounded-md">
                Admin
              </span>
            )}
          </p>
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
            className="text-subtle hover:text-accent text-sm flex items-center gap-1 mr-4"
          >
            <PencilSimple size={16} /> Edit post
          </button>
        )}
      </div>

      {editing ? (
        <EditPost post={post} onSuccess={() => location.reload()} />
      ) : (
        <>
          {/* Post info */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 items-start">
            {/* LEFT: Safety + File Type */}
            <div>
              <p>
                <span className="text-white font-medium">Safety:</span>{" "}
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    post.safety === "SAFE"
                      ? "bg-green-500/10 text-green-400"
                      : post.safety === "SKETCHY"
                      ? "bg-yellow-500/10 text-yellow-400"
                      : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {post.safety}
                </span>
              </p>

              {post.fileExt && (
                <p className="text-subtle text-sm mt-1">
                  <span className="text-white font-medium mr-1">File Type: </span>
                  {FILE_TYPE_LABELS[post.fileExt] ?? post.fileExt}
                </p>
              )}
            </div>

            {/* RIGHT: Score + Favorites + File Size */}
            <div className="flex flex-col items-end mr-4">
              <div className="flex gap-4">
                <p className="flex items-center gap-1">
                  <ThumbsUp size={16} weight="fill" className="!text-green-600" />
                  <a className="text-zinc-400">{post.score}</a>
                </p>
                <p className="flex items-center gap-1">
                  <Heart size={16} weight="fill" className="!text-red-600" />
                  <a className="text-zinc-400">{post.favorites ?? 0}</a>
                </p>
              </div>

              {typeof post.fileSize === "number" && (
                <p className="flex items-center gap-1 text-subtle text-sm mt-1">
                  <FloppyDisk size={16} weight="bold" className="text-accent" />
                  <a className="text-zinc-400">{formatStorageFromBytes(post.fileSize)}</a>
                </p>
              )}
            </div>
          </div>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-col gap-4 mt-4">
              {Object.entries(
                post.tags.reduce((acc: Record<string, { name: string; color: string }[]>, tag) => {
                  const category = tag.category?.name || "Uncategorized";
                  if (!acc[category]) acc[category] = [];
                  acc[category].push({
                    name: tag.name,
                    color: tag.category?.color || "#ccc",
                  });
                  return acc;
                }, {})
              ).map(([category, tags]) => (
                <div key={category}>
                  <p className="text-white text-sm font-medium mb-1">{category}</p>
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag, i) => (
                      <div
                      key={i}
                      className="flex items-center gap-1 text-sm border border-secondary-border px-2 py-1 rounded-full"
                      style={{ color: tag.color }}
                    >
                      {/* Tag icon to dashboard */}
                      <Link
                        href={`/dashboard/tags/${tag.name}`}
                        title="Edit tag in dashboard"
                        className="hover:opacity-90"
                      >
                        <Tag size={14} />
                      </Link>
                    
                      {/* Tag name → replace search */}
                      <button
                        onClick={() => modifyQuery("replace", tag.name)}
                        className="hover:underline"
                        title="Search posts with only this tag"
                      >
                        {tag.name}
                      </button>
                    
                      {/* + Add tag to current query */}
                      <button
                        onClick={() => modifyQuery("add", tag.name)}
                        className="hover:text-accent"
                        title="Add tag to search"
                      >
                        <Plus size={14} weight="bold" />
                      </button>
                    
                      {/* - Exclude tag */}
                      <button
                        onClick={() => modifyQuery("exclude", tag.name)}
                        className="hover:text-accent"
                        title="Exclude tag from search"
                      >
                        <Minus size={14} weight="bold" />
                      </button>
                    </div>
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
