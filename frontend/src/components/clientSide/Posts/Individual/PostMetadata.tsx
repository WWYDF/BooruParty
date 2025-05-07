"use client";

import { useState } from "react";
import EditPost from "./EditPost";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PencilSimple, Minus, Plus, Tag } from "phosphor-react";
import { formatStorageFromBytes } from "@/core/formats";
import { FILE_TYPE_LABELS } from "@/core/dictionary";
import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { useToast } from "../../Toast";

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
        order: number;
      };
      aliases: {
        id: number;
        alias: string;
      }[];
    }[];
    relatedFrom: {
      to: {
        id: number;
        previewPath: string | null;
      };
    }[];
    relatedTo: {
      from: {
        id: number;
        previewPath: string | null;
      };
    }[];
    pools: {
      poolId: number;
      pool: {
        id: number;
        name: string;
        safety: "SAFE" | "SKETCHY" | "UNSAFE";
        _count: {
          items: number;
        },
        items: {
          index: number;
          post: {
            id: number;
            previewPath: string | null;
          };
        }[];
      };
    }[];
    uploadedBy: {
      id: string;
      username: string;
      role: {
        name: string;
      };
      avatar: string;
    },
    fileSize?: number;
    _count?: {
      favoritedBy: number;
    };
  };
};


export default function PostMetadata({ post }: Props) {
  const [editing, setEditing] = useState(false);
  const [lastCheckTime, setLastCheckTime] = useState<number | null>(null);
  const router = useRouter();
  const toast = useToast();

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

  // 1. Group tags by category
  const grouped = post.tags.reduce((acc: Record<string, { tag: typeof post.tags[0]; order: number }[]>, tag) => {
    const name = tag.category?.name || "Uncategorized";
    const order = tag.category?.order ?? 9999; // fallback to end
    if (!acc[name]) acc[name] = [];
    acc[name].push({ tag, order });
    return acc;
  }, {});

  // 2. Sort category blocks by their `order` field
  const sortedCategories = Object.entries(grouped).sort(
    ([, tagsA], [, tagsB]) => (tagsA[0]?.order ?? 0) - (tagsB[0]?.order ?? 0)
  );

  const checkEditPermissions = async () => {
    const now = Date.now();
  
    // If user clicked too recently, block
    if (lastCheckTime && now - lastCheckTime < 350) {
      toast("Please wait before trying again.", "error");
      return;
    }
  
    setLastCheckTime(now);
  
    const res = await fetch("/api/users/permissions");
    if (!res.ok) {
      toast("Only users signed in can edit posts.", "error");
      return;
    }
  
    const data = await res.json();
    const isOwner = post.uploadedBy.id === data.userId;
    const perms: string[] = data.permissions;
  
    const canEdit =
      (isOwner && perms.includes("post_edit_own")) ||
      (!isOwner && perms.includes("post_edit_others"));
  
    if (canEdit) {
      setEditing(true);
    } else {
      toast("You do not have permission to edit this post.", "error");
    }
  };

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
          <p className="text-base text-white font-semibold flex items-center">
            {displayName}
            {!post.anonymous && (
              <RoleBadge role={post.uploadedBy.role.name} />
            )}
          </p>
          <p className="text-xs text-subtle">{new Date(post.createdAt).toLocaleString()}</p>
        </div>

        {editing ? (
          <button
            onClick={() => setEditing(false)}
            className="text-sm text-white bg-secondary-border transition px-3 py-1 mr-4 rounded hover:bg-accent hover:text-black"
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={checkEditPermissions}
            className="text-subtle hover:text-accent text-sm flex items-center gap-1 mr-4"
          >
            <PencilSimple size={16} /> Edit post
          </button>
        )}
      </div>

      {editing ? (
        <div className="mr-4">
          <EditPost
            post={post}
            onSaveSuccess={() => {
              router.refresh();
              setEditing(false);
              toast(`Updated Post #${post.id}!`, 'success')
            }}
            onDeleteSuccess={() => {
              router.push("/posts");
              toast(`Deleted Post #${post.id}!`, 'success')
            }}
          />
        </div>
      ) : (
        <>
          {/* Post info */}
          <div>
            <p className="flex items-baseline gap-1 text-xs">
              <span className="text-white font-medium w-[80px]">Safety:</span>
              <span
                className={`font-semibold ${
                  post.safety === "SAFE"
                    ? "text-green-400"
                    : post.safety === "SKETCHY"
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}
              >
                {post.safety}
              </span>
            </p>

            {post.fileExt && (
              <p className="flex items-center gap-1 text-xs text-subtle">
                <span className="text-white font-medium w-[80px]">File Type:</span>
                {FILE_TYPE_LABELS[post.fileExt] ?? post.fileExt}
              </p>
            )}

            {typeof post.fileSize === "number" && (
              <p className="flex items-center gap-1 text-xs text-subtle">
                <span className="text-white font-medium w-[80px]">File Size:</span>
                {formatStorageFromBytes(post.fileSize ?? 0)}
              </p>
            )}

            <p className="flex items-center gap-1 text-xs text-subtle">
              <span className="text-white font-medium w-[80px]">User Score:</span>
              {post.score}
            </p>

            {typeof post._count?.favoritedBy === "number" && (
              <p className="flex items-center gap-1 text-xs text-subtle">
                <span className="text-white font-medium w-[80px]">Favorites:</span>
                {post._count?.favoritedBy}
              </p>
            )}
          </div>


          {/* Related Posts */}
          {(post.relatedFrom.length > 0 || post.relatedTo.length > 0) && (
            <div className="mt-4">
              <p className="text-white font-medium text-sm mb-1">Related Posts:</p>
              <div className="flex flex-wrap gap-2">
                {[
                  ...post.relatedFrom.map(r => r.to),
                  ...post.relatedTo.map(r => r.from),
                ]
                  .filter((v, i, a) => v && a.findIndex(x => x.id === v.id) === i)
                  .map((related) => (
                    <Link key={related.id} href={`/post/${related.id}`}>
                      <img
                        src={`${process.env.NEXT_PUBLIC_FASTIFY}/data/thumbnails/${related.id}_small.webp`}
                        alt={`Related post ${related.id}`}
                        className="w-16 h-16 object-cover rounded border border-secondary-border hover:scale-105 transition"
                      />
                    </Link>
                  ))}
              </div>
            </div>
          )}


          {/* Pools */}
          {post.pools.length > 0 && (
            <div className="mt-4">
              <p className="text-white font-medium text-sm mb-1">Pools:</p>
              <div className="flex flex-wrap gap-4">
                {post.pools.map(({ poolId, pool }) => {
                  const cover = pool.items[0]?.post;
                  const match = pool.items.find(item => item.post.id === post.id);
                  const currentIndex = match?.index ?? 0;
                  const total = pool._count.items;

                  return (
                    <Link
                      key={pool.id}
                      href={`/pools/${pool.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-[54px] h-[96px] overflow-hidden rounded border border-secondary-border bg-zinc-800">
                        {cover?.previewPath ? (
                          <img
                            src={cover.previewPath}
                            alt={`Pool ${pool.name}`}
                            className="w-full h-full object-cover group-hover:scale-105 transition"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                            No preview
                          </div>
                        )}
                      </div>
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            pool.safety === "SAFE"
                              ? "text-green-400"
                              : pool.safety === "SKETCHY"
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {pool.name}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          Page {currentIndex + 1} of {total}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}



          {/* Sources */}
          {post.sources.length > 0 && (
            <div className="mt-4">
              <p className="text-white font-medium text-sm mb-1">Sources:</p>
              <div className="bg-zinc-900 px-4 py-2 rounded border border-secondary-border text-sm space-y-1 mr-3">
                {post.sources.map((src, i) => (
                  <p key={i} className="break-all">
                    <Link href={src} target="_blank" className="text-accent underline">
                      {src}
                    </Link>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {post.notes && (
            <div className="mt-3">
              <p className="text-white font-medium text-sm mb-1">Notes:</p>
              <div className="bg-zinc-900 px-4 py-2 rounded border border-secondary-border text-sm whitespace-pre-wrap text-subtle mr-3">
                {post.notes}
              </div>
            </div>
          )}


          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-col gap-4 mt-4">
              {sortedCategories.map(([categoryName, items]) => (
                <div key={categoryName}>
                  <p className="text-white text-base font-semibold mb-1">{categoryName}</p>
                  <div className="flex flex-col gap-2">
                    {items.map(({ tag }) => (
                      <div
                        key={tag.id}
                        className="inline-flex items-center gap-1 border border-zinc-900 px-2 py-1 rounded-full w-fit"
                        style={{ color: tag.category?.color || "#fff" }}
                      >
                        <Link href={`/tags/${tag.name}`} title="Edit tag">
                          <Tag size={14} />
                        </Link>

                        <button
                          onClick={() => modifyQuery("replace", tag.name)}
                          className="hover:underline"
                          title="Search only this tag"
                        >
                          {tag.name}
                        </button>

                        <button
                          onClick={() => modifyQuery("add", tag.name)}
                          className="hover:text-accent"
                          title="Add tag to search"
                        >
                          <Plus size={14} weight="bold" />
                        </button>

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
