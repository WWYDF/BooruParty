"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowSquareOutIcon,
  CodeIcon,
  CopyIcon,
  EyeIcon,
  GoogleLogoIcon,
  MinusIcon,
  PencilSimpleIcon,
  PlusIcon,
  PuzzlePieceIcon,
  SparkleIcon,
  StarIcon,
  TagIcon,
  ThumbsUpIcon,
} from "@phosphor-icons/react";
import { formatCounts, formatStorageFromBytes } from "@/core/formats";
import { API, errorText } from "@/core/api";
import { RoleBadge } from "@/components/RoleBadge";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import { PostDetail, Safety } from "@/core/types/posts";
import { SAFETY_STYLES } from "@/core/types/uploads";
import { CategoryInfo } from "@/core/types/tags";
import PostEditing from "./PostEditing";
import { defaultAvatar } from "@/core/constants/defaults";

const SAFETY_TEXT: Record<Safety, string> = {
  SAFE: "text-green-400",
  QUESTIONABLE: "text-yellow-400",
  EXPLICIT: "text-red-400",
};

// Placeholders for features the new API doesn't have yet
// Swap later, the JSX below already handles them.
const PLACEHOLDER = {
  anonymous: false,
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

const formatDuration = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export default function PostMetadata({
  post,
  categories,
  canEdit,
  onReload,
}: {
  post: PostDetail;
  categories: Map<number, CategoryInfo>;
  canEdit: boolean;
  onReload: () => void; // refetch the post after an edit
}) {
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [editing, setEditing] = useState(false);
  const router = useRouter();
  const toast = useToast();
  const { user } = useUser();

  const canFeature = user?.permissions.includes("posts.feature") ?? false;
  const [featureBusy, setFeatureBusy] = useState(false);

  // Applies instantly: PUT features this post (replacing the current one), DELETE unfeatures it
  const toggleFeatured = async () => {
    setFeatureBusy(true);
    try {
      const res = await API(`/api/posts/${post.id}/feature`, { method: post.featured ? "DELETE" : "PUT" });
      if (!res.ok) {
        toast(errorText(await res.json().catch(() => ({}))), "error");
        return;
      }
      toast(post.featured ? "Post unfeatured" : "Post featured!", "success");
      onReload(); // picks up the new `featured` flag
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setFeatureBusy(false);
    }
  };

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

    window.addEventListener("post:image-dimensions", onDims as EventListener);
    return () => {
      window.removeEventListener("post:image-dimensions", onDims as EventListener);
    };
  }, [post.id]);

  // Only sources that parse as URLs get a row
  const sources = post.sources.flatMap((src) => {
    try {
      return [{ href: src, host: new URL(src).hostname.replace(/^www\./, "") }];
    } catch {
      return [];
    }
  });

  return (
    <div className="mr-4 flex flex-col gap-5 text-sm text-subtle">
      {/* Header with user info */}
      <div className="flex items-center gap-3">
        <img
          src={uploader.avatar ?? defaultAvatar}
          alt="Uploader avatar"
          width={48}
          height={48}
          className="rounded-full border border-secondary-border"
        />

        <div className="min-w-0 flex-1">
          <p className="flex items-center text-base font-semibold text-white">
            {
              <>
                <Link href={`/users/${encodeURIComponent(uploader.username)}`} className="truncate text-accent hover:underline">
                  {uploader.username}
                </Link>
                
              </>
            }
          </p>

          <span className={`inline-flex items-center font-medium text-xs`}
            style={{ color: uploader.role.color }}
          >
            {uploader.role.name}
          </span>
        </div>

        {canFeature && !editing && (
          <Button
            size="sm"
            icon={<StarIcon size={14} weight={post.featured ? "fill" : "regular"} className={post.featured ? "text-yellow-400" : ""} />}
            loading={featureBusy}
            onClick={toggleFeatured}
            title={post.featured ? "Remove this post from the homepage" : "Show this post on the homepage (replaces the current one)"}
          >
            {post.featured ? "Featured" : "Feature"}
          </Button>
        )}

        {editing ? (
          <Button size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        ) : canEdit ? (
          <Button size="sm" icon={<PencilSimpleIcon size={14} />} onClick={() => setEditing(true)}>
            Edit
          </Button>
        ) : null}
      </div>

      {editing ? (
        <PostEditing
          post={post}
          categories={categories}
          onSaved={() => { setEditing(false); onReload(); }}
          onDeleted={() => router.push("/posts")}
        />
      ) : (
        <>
          {/* Stats bar (Score, Favorites, and Boosts) */}
          <div className="flex items-center gap-4">
            <button
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-secondary-border bg-zinc-900/60 px-3 py-2"
              onClick={() => router.push(`/posts?query=${encodeURIComponent("order:score")}`)}
            >
              <ThumbsUpIcon size={16} className="text-green-400" />
              <span className="text-xs text-white/80">Score</span>
              <span className="text-xs font-semibold text-subtle">{formatCounts(post.score)}</span>
            </button>

            <button
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-secondary-border bg-zinc-900/60 px-3 py-2"
              onClick={() => router.push(`/posts?query=${encodeURIComponent("order:favorites")}`)}
            >
              <StarIcon size={16} className="text-yellow-400" />
              <span className="text-xs text-white/80">Favorites</span>
              <span className="text-xs font-semibold text-subtle">{formatCounts(post.favoriteCount)}</span>
            </button>

            <button
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-secondary-border bg-zinc-900/60 px-3 py-2"
              onClick={() => router.push(`/posts?query=${encodeURIComponent("order:boosts")}`)}
            >
              <SparkleIcon size={16} className="text-cyan-400" />
              <span className="text-xs text-white/80">Boosts</span>
              <span className="text-xs font-semibold text-subtle">{formatCounts(post.boostCount ?? 0)}</span>
            </button>
          </div>

          {/* Post + file info */}
          <div>
            <h3 className="text-zinc-200 font-medium text-sm mb-2">Details</h3>
            <dl className="divide-y divide-secondary-border overflow-hidden rounded-xl border border-secondary-border bg-zinc-900/40">
              <InfoRow label="Safety">
                <span className={`font-semibold ${SAFETY_TEXT[post.safety]}`}>{SAFETY_STYLES[post.safety].label}</span>
              </InfoRow>
              <InfoRow label="Type">{typeLabel} ({fileExt})</InfoRow>
              <InfoRow label="Original Size">
                {formatStorageFromBytes(post.fileSize)}
              </InfoRow>
              {post.previewSize !== null && (
                <InfoRow label="Preview Size">
                  {formatStorageFromBytes(post.previewSize)}
                </InfoRow>
              )}
              {dimensions && <InfoRow label="Dimensions">{dimensions.w} × {dimensions.h}</InfoRow>}
              {post.duration !== null && <InfoRow label="Duration">{formatDuration(post.duration)}</InfoRow>}
              {post.type === "VIDEO" && post.hasAudio !== null && (
                <InfoRow label="Audio">{post.hasAudio ? "Yes" : "No"}</InfoRow>
              )}
              <InfoRow label="Uploaded">{new Date(post.createdAt).toLocaleString()}</InfoRow>
            </dl>
          </div>

          {/* Sources */}
          {sources.length > 0 && (
            <div>
              <h3 className="text-zinc-200 font-medium text-sm mb-2">Sources</h3>
              <div className="divide-y divide-secondary-border overflow-hidden rounded-xl border border-secondary-border bg-zinc-900/40">
                {sources.map((src) => (
                  <Link
                    key={src.href}
                    href={src.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={src.href}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-accent transition hover:bg-zinc-800/60"
                  >
                    <span className="truncate">{src.host}</span>
                    <ArrowSquareOutIcon size={14} className="ml-auto shrink-0 text-subtle" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              size="sm"
              icon={<GoogleLogoIcon size={14} />}
              onClick={() =>
                window.open(
                  `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(post.thumbnails.large)}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
              title="Search Google Images for this post"
            >
              Search
            </Button>
            <Button size="sm" icon={<CopyIcon size={14} />} onClick={copyPreview} title="Copy the preview's URL">
              Copy
            </Button>
            <Button size="sm" icon={<CodeIcon size={14} />} onClick={copyEmbed} title="Copy the embed code for comments">
              Embed
            </Button>
            {PLACEHOLDER.jigsawEnabled && post.type !== "VIDEO" && (
              <Button
                size="sm"
                className="col-span-3"
                icon={<PuzzlePieceIcon size={14} />}
                onClick={() => router.push(`/games/jigsaw?postId=${post.id}`)}
              >
                Play Jigsaw
              </Button>
            )}
          </div>

          {/* Related Posts */}
          {post.related.length > 0 && (
            <div>
              <h3 className="text-zinc-200 font-medium text-sm mb-2">Related Posts</h3>
              <div className="flex flex-wrap gap-2">
                {post.related.map((related) => (
                  <Link key={related.id} href={`/post/${related.id}`} title={`Post #${related.id}`}>
                    <img
                      src={related.thumbnails.small}
                      alt={`Related post ${related.id}`}
                      className="h-16 w-16 rounded-lg border border-secondary-border object-cover transition hover:scale-105"
                    />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Pools */}
          {post.pools.length > 0 && (
            <Section title="Pools">
              <div className="flex flex-col gap-3">
                {post.pools.map((pool) => (
                  <div key={pool.id} className="group flex items-center gap-3">
                    <Link
                      href={`/pools/${pool.id}`}
                      className="h-24 w-13.5 shrink-0 overflow-hidden rounded-lg border border-secondary-border bg-zinc-800"
                    >
                      {pool.cover ? (
                        <img
                          src={pool.cover.thumbnails.small}
                          alt={`Pool ${pool.name}`}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-500">
                          No preview
                        </div>
                      )}
                    </Link>
                    <div className="min-w-0">
                      <Link
                        href={`/pools/${pool.id}`}
                        className={`block truncate text-sm font-medium hover:underline ${pool.safety ? SAFETY_TEXT[pool.safety] : "text-white"}`}
                      >
                        {pool.name}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-zinc-400">
                        {pool.postCount} {pool.postCount === 1 ? "post" : "posts"}
                        {pool.artist && <> · by {pool.artist.name}</>}
                      </p>
                      <Link href={`/post/${post.id}?pool=${pool.id}`} className="mt-0.5 block text-xs text-accent hover:underline">
                        Step through pool
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Notes */}
          {post.notes && (
            <div>
              <h3 className="text-zinc-200 font-medium text-sm mb-2">Notes</h3>
              <div className="whitespace-pre-wrap rounded-xl border border-secondary-border bg-zinc-900/40 px-3 py-2 text-sm text-zinc-400">
                {post.notes}
              </div>
            </div>
          )}

          {/* Tags */}
          {post.tags.length > 0 && (
            <div>
              <h3 className="text-white font-medium text-lg mb-2">Tags ({post.tags.length})</h3>
              <div className="flex flex-col gap-4">
                {tagGroups.map((group) => (
                  <div key={group.category?.id ?? "unknown"}>
                    <p className="mb-1.5 flex items-center gap-1 text-sm text-subtle">
                      {group.category?.name ?? "Other"}
                      {group.tags.length >= 5 && <span className="text-zinc-500">({group.tags.length})</span>}
                    </p>
                    <div className="flex flex-col gap-2">
                      {group.tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="inline-flex w-fit items-center gap-1 rounded-full border border-zinc-900 px-2 py-1"
                          style={{ color: group.category?.color ?? "#fff" }}
                        >
                          <button
                            onClick={() => modifyQuery("add", tag.name)}
                            className="cursor-pointer transition hover:text-green-400"
                            title="Add tag to search"
                          >
                            <PlusIcon size={12} weight="bold" />
                          </button>

                          <button
                            onClick={() => modifyQuery("exclude", tag.name)}
                            className="cursor-pointer transition hover:text-red-400"
                            title="Exclude tag from search"
                          >
                            <MinusIcon size={12} weight="bold" />
                          </button>

                          <Link href={`/tags/${encodeURIComponent(tag.name)}`} title="View tag">
                            <TagIcon size={14} className="transition hover:opacity-80" />
                          </Link>

                          <button
                            onClick={() => modifyQuery("replace", tag.name)}
                            className="cursor-pointer hover:underline"
                            title="Search only this tag"
                          >
                            {tag.name}
                          </button>

                          <span className="ml-1 text-xs text-subtle">{formatCounts(tag.postCount ?? 0)}</span>
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

// Small uppercase heading over a block (to be removed)
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-subtle">{title}</h3>
      {children}
    </section>
  );
}

// One label/value line inside a <dl> card
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2 text-xs">
      <dt className="text-subtle">{label}</dt>
      <dd className="text-right text-zinc-200">{children}</dd>
    </div>
  );
}
