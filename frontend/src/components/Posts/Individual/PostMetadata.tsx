"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilSimpleIcon, MinusIcon, PlusIcon, TagIcon, StarIcon, SparkleIcon, ThumbsUpIcon } from "@phosphor-icons/react";
import { formatCounts, formatStorageFromBytes } from "@/core/formats";
import { RoleBadge } from "@/components/RoleBadge";
import { useToast } from "@/components/UI/Toast";
import { PostDetail } from "@/core/types/posts";
import { CategoryInfo } from "./PostView";
import { defaultAvatar } from "@/core/constants/defaults";

const SAFETY_COLORS: Record<PostDetail["safety"], string> = {
  SAFE: "text-green-400",
  QUESTIONABLE: "text-yellow-400",
  EXPLICIT: "text-red-400",
};

// Placeholders for features the new API doesn't have yet
// Swap later, the JSX below already handles them.
type RelatedPost = { id: number; thumbnail: string };
type PostPool = {
  id: number;
  name: string;
  safety: PostDetail["safety"];
  cover: string | null; // thumbnail URL
  page: number;         // this post's position in the pool
  total: number;
};
const PLACEHOLDER = {
  anonymous: false,
  favorites: 0,
  boosts: 0,
  related: [] as RelatedPost[],
  pools: [] as PostPool[],
  jigsawEnabled: false,
};

type TagGroup = { category: CategoryInfo | null; tags: PostDetail["tags"] };

// Group tags by category, in the categories' configured order (unknown categories last)
function groupTags(tags: PostDetail["tags"], categories: Map<number, CategoryInfo>): TagGroup[] {
  const groups = new Map<number, TagGroup>();
  for (const tag of tags) {
    const group = groups.get(tag.categoryId) ?? { category: categories.get(tag.categoryId) ?? null, tags: [] };
    group.tags.push(tag);
    groups.set(tag.categoryId, group);
  }
  return [...groups.values()].sort(
    (a, b) => (a.category?.index ?? Infinity) - (b.category?.index ?? Infinity),
  );
}

export default function PostMetadata({
  post,
  categories,
  canEdit,
}: {
  post: PostDetail;
  categories: Map<number, CategoryInfo>;
  canEdit: boolean;
}) {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [viewingFull, setViewingFullState] = useState<boolean>(false);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function modifyQuery(action: "replace" | "add" | "exclude", tag: string) {
    const saved = JSON.parse(sessionStorage.getItem("lastSearchParams") ?? "{}");
    const parts: string[] = (saved.query ?? "").split(/\s+/).filter(Boolean);

    let newQuery = "";
    if (action === "replace") {
      newQuery = tag;
    } else {
      const term = action === "add" ? tag : `-${tag}`;
      if (!parts.includes(term)) parts.push(term);
      newQuery = parts.join(" ");
    }

    sessionStorage.setItem("lastSearchParams", JSON.stringify({ ...saved, query: newQuery }));
    router.push(`/posts?query=${encodeURIComponent(newQuery)}`);
  }

  const uploader = post.uploader;
  const fileExt = post.originalPath.split(".").pop()?.toUpperCase() ?? "";
  const typeLabel = post.type.charAt(0) + post.type.slice(1).toLowerCase(); // IMAGE -> Image
  const tagGroups = groupTags(post.tags, categories);

  const copyPreview = async () => {
    await navigator.clipboard.writeText(post.previewPath ?? post.originalPath);
    toast("Copied Preview URL!", "success");
  };

  const copyEmbed = async () => {
    await navigator.clipboard.writeText(`:${post.id}:`);
    toast("Copied Post Embed!", "success");
  };

  useEffect(() => {
    // Clear cached dimensions for other posts
    Object.keys(sessionStorage)
      .filter((k) => (k.startsWith("bp:dims:") || k.startsWith("bp:size:")) && !k.endsWith(`:${post.id}`))
      .forEach((k) => sessionStorage.removeItem(k));

    // Read from sessionStorage (instant on refresh)
    try {
      const rawDims = sessionStorage.getItem(`bp:dims:${post.id}`);
      if (rawDims) {
        const parsed = JSON.parse(rawDims) as { w: number; h: number };
        if (parsed?.w && parsed?.h) setDimensions({ w: parsed.w, h: parsed.h });
      }
    } catch {}

    // Live updates from PostDisplay
    const onDims = (e: Event) => {
      const { postId, w, h } = (e as CustomEvent).detail || {};
      if (postId === post.id && w && h) setDimensions({ w, h });
    };
    const onViewingChange = (e: Event) => {
      const { state } = (e as CustomEvent).detail || {};
      setViewingFullState(state);
    };

    window.addEventListener("post:image-dimensions", onDims as EventListener);
    window.addEventListener("post:changeViewingState", onViewingChange as EventListener);
    return () => {
      window.removeEventListener("post:image-dimensions", onDims as EventListener);
      window.removeEventListener("post:changeViewingState", onViewingChange as EventListener);
    };
  }, [post.id]);

  // The API gives exact sizes now, so no need to measure them in the browser
  const showingPreview = !viewingFull && post.previewSize !== null;
  const fileSizeText = showingPreview
    ? `${formatStorageFromBytes(post.previewSize!)} (Preview)`
    : `${formatStorageFromBytes(post.fileSize)} (Full)`;

  return (
    <div className="flex flex-col gap-4 text-sm text-subtle">
      {/* Header with user info */}
      <div className="flex items-center gap-3">
        <img
          src={defaultAvatar}
          alt="Uploader avatar"
          width={48}
          height={48}
          className="rounded-full border border-secondary-border"
        />

        <div className="flex-1">
          <p className="text-base text-white font-semibold flex items-center gap-2">
            {PLACEHOLDER.anonymous ? (
              <span className="text-zinc-500">Anonymous</span>
            ) : (
              <>
                <Link href={`/users/${encodeURIComponent(uploader.username)}`} className="text-accent hover:underline">
                  {uploader.username}
                </Link>
                <RoleBadge role={uploader.role} />
              </>
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
        ) : canEdit ? (
          <button
            onClick={() => setEditing(true)}
            className="text-subtle hover:text-accent transition-colors text-sm flex items-center gap-1 mr-4"
          >
            <PencilSimpleIcon size={16} /> Edit post
          </button>
        ) : null}
      </div>

      {/* Stats bar (Score, Favorites, and Boosts) */}
      {!editing && (
        <div className="flex items-center gap-4 mr-4">
          <button
            className="flex items-center gap-2 rounded-xl border border-secondary-border bg-zinc-900/60 px-3 py-2"
            onClick={() => router.push(`/posts?query=${encodeURIComponent("order:score")}`)}
          >
            <ThumbsUpIcon size={16} className="text-green-400" />
            <span className="text-xs text-white/80">Score</span>
            <span className="text-xs font-semibold text-subtle">{formatCounts(post.score)}</span>
          </button>

          {/* No order:favorites / order:boosts in the search yet, so these don't link anywhere */}
          <div className="flex items-center gap-2 rounded-xl border border-secondary-border bg-zinc-900/60 px-3 py-2">
            <StarIcon size={16} className="text-yellow-400" />
            <span className="text-xs text-white/80">Favorites</span>
            <span className="text-xs font-semibold text-subtle">{formatCounts(PLACEHOLDER.favorites)}</span>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-secondary-border bg-zinc-900/60 px-3 py-2">
            <SparkleIcon size={16} className="text-cyan-400" />
            <span className="text-xs text-white/80">Boosts</span>
            <span className="text-xs font-semibold text-subtle">{formatCounts(PLACEHOLDER.boosts)}</span>
          </div>
        </div>
      )}

      {editing ? (
        <div className="mr-4">
          {/* EditPost still uses the old Post type, and there's no PATCH /api/posts/:id yet */}
          <p className="text-subtle">Post editing isn't available yet.</p>
        </div>
      ) : (
        <>
          {/* Post info */}
          <div>
            <p className="flex items-baseline gap-1 text-xs">
              <span className="text-white font-medium w-[80px]">Safety</span>
              <span className={`font-semibold ${SAFETY_COLORS[post.safety]}`}>{post.safety}</span>
            </p>

            <p className="flex items-center gap-1 text-xs text-subtle">
              <span className="text-white font-medium w-[80px]">File Type</span>
              {typeLabel} ({fileExt})
            </p>

            <p className="flex items-center gap-1 text-xs text-subtle">
              <span className="text-white font-medium w-[80px]">File Size</span>
              {fileSizeText}
            </p>

            {dimensions && (
              <p className="flex items-center gap-1 text-xs text-subtle">
                <span className="text-white font-medium w-[80px]">Dimensions</span>
                {dimensions.w} × {dimensions.h}
              </p>
            )}

            {post.duration !== null && (
              <p className="flex items-center gap-1 text-xs text-subtle">
                <span className="text-white font-medium w-[80px]">Duration</span>
                {Math.floor(post.duration / 60)}:{String(Math.floor(post.duration % 60)).padStart(2, "0")}
                {post.hasAudio === false && " (no audio)"}
              </p>
            )}

            {post.sources.length > 0 && (
              <p className="flex items-start gap-1 text-xs text-subtle">
                <span className="text-white font-medium w-[80px]">Sources</span>
                <span className="flex-1 text-xs">
                  {post.sources.map((src, i) => {
                    try {
                      const url = new URL(src);
                      return (
                        <span key={i}>
                          <Link
                            href={src}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-accent hover:underline focus:outline-none"
                            title={src}
                          >
                            {url.hostname}
                          </Link>
                          {i < post.sources.length - 1 && <span className="text-subtle">, </span>}
                        </span>
                      );
                    } catch {
                      return null;
                    }
                  })}
                </span>
              </p>
            )}

            <p className="flex items-start gap-1 text-xs text-subtle">
              <span className="text-white font-medium w-[80px]">Search</span>
              <Link
                href={`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(post.thumbnails.large)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline focus:outline-none"
              >
                Google Images
              </Link>
            </p>

            <p className="flex items-center gap-1 text-xs text-subtle">
              <span className="text-white font-medium w-[80px]">Preview</span>
              <button onClick={copyPreview} className="text-accent hover:underline focus:outline-none">
                Click to Copy
              </button>
            </p>

            <p className="flex items-center gap-1 text-xs text-subtle">
              <span className="text-white font-medium w-[80px]">Embed</span>
              <button onClick={copyEmbed} className="text-accent hover:underline focus:outline-none">
                Click to Copy
              </button>
            </p>

            {PLACEHOLDER.jigsawEnabled && post.type !== "VIDEO" && (
              <p className="flex items-start gap-1 text-xs text-subtle">
                <span className="text-white font-medium w-[80px]">Jigsaw</span>
                <button
                  onClick={() => router.push(`/games/jigsaw?postId=${post.id}`)}
                  className="text-accent hover:underline focus:outline-none"
                >
                  Click to Play
                </button>
              </p>
            )}
          </div>

          {/* Related Posts */}
          {PLACEHOLDER.related.length > 0 && (
            <div className="mt-4">
              <p className="text-white font-medium text-sm mb-1">Related Posts</p>
              <div className="flex flex-wrap gap-2">
                {PLACEHOLDER.related.map((related) => (
                  <Link key={related.id} href={`/post/${related.id}`}>
                    <img
                      src={related.thumbnail}
                      alt={`Related post ${related.id}`}
                      className="w-16 h-16 object-cover rounded border border-secondary-border hover:scale-105 transition"
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Pools */}
          {PLACEHOLDER.pools.length > 0 && (
            <div className="mt-4">
              <p className="text-white font-medium text-sm mb-1">Pools</p>
              <div className="flex flex-col gap-4">
                {PLACEHOLDER.pools.map((pool) => (
                  <Link key={pool.id} href={`/pools/${pool.id}`} className="flex items-center gap-3 group">
                    <div className="w-[54px] h-[96px] overflow-hidden rounded border border-secondary-border bg-zinc-800">
                      {pool.cover ? (
                        <img
                          src={pool.cover}
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
                      <p className={`text-sm font-medium ${SAFETY_COLORS[pool.safety]}`}>{pool.name}</p>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Page {pool.page} of {pool.total}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {post.notes && (
            <div className="mt-3">
              <p className="text-white font-medium text-sm mb-1">Notes</p>
              <div className="bg-zinc-900/75 px-4 py-2 rounded border border-secondary-border text-sm whitespace-pre-wrap text-subtle mr-3">
                {post.notes}
              </div>
            </div>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="mt-3">
              <p className="text-white font-medium text-lg mb-2">Tags ({post.tags.length})</p>
              <div className="flex flex-col gap-3">
                {tagGroups.map((group) => (
                  <div key={group.category?.id ?? "unknown"}>
                    <p className="text-subtle text-sm mb-1">
                      {group.category?.name ?? "Other"} {group.tags.length >= 5 ? `(${group.tags.length})` : ""}
                    </p>
                    <div className="flex flex-col gap-2">
                      {group.tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="inline-flex items-center gap-1 border border-zinc-900 px-2 py-1 rounded-full w-fit"
                          style={{ color: group.category?.color ?? "#fff" }}
                        >
                          <button
                            onClick={() => modifyQuery("add", tag.name)}
                            className="hover:text-green-400 transition"
                            title="Add tag to search"
                          >
                            <PlusIcon size={10} weight="bold" />
                          </button>

                          <button
                            onClick={() => modifyQuery("exclude", tag.name)}
                            className="hover:text-red-400 transition"
                            title="Exclude tag from search"
                          >
                            <MinusIcon size={10} weight="bold" />
                          </button>

                          <Link href={`/tags/${encodeURIComponent(tag.name)}`} title="View tag">
                            <TagIcon size={14} className="hover:opacity-80 transition" />
                          </Link>

                          <button
                            onClick={() => modifyQuery("replace", tag.name)}
                            className="hover:underline"
                            title="Search only this tag"
                          >
                            {tag.name}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
