"use client";

import { useState } from "react";
import EditPost from "./EditPost";
import { PencilSimple, Tag as TagIcon } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Tag } from "phosphor-react";

const AVATAR_URL = "/user.png";

type Props = {
  post: {
    id: number;
    anonymous: boolean;
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
    }
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

      {/* Content area */}
      {editing ? (
        <EditPost post={post} onSuccess={() => location.reload()} />
      ) : (
        <>
          {/* Post info */}
          <div className="grid grid-cols-2 gap-y-2 gap-x-4 mt-2">
            <p><span className="text-white font-medium">Safety:</span> {post.safety}</p>
            <p><span className="text-white font-medium">Score:</span> {post.score}</p>
            <p className="col-span-2">
              <span className="text-white font-medium">Sources:</span>{" "}
              {post.sources.length ? (
                <span className="flex flex-wrap gap-2">
                  {post.sources.map((src, i) => (
                    <Link
                      key={i}
                      href={src}
                      target="_blank"
                      className="text-accent underline break-all"
                    >
                      {src}
                    </Link>
                  ))}
                </span>
              ) : (
                "None"
              )}
            </p>
            <p className="col-span-2">
              <span className="text-white font-medium">Notes:</span>{" "}
              {post.notes || "None"}
            </p>
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
