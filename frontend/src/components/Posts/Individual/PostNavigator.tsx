"use client";

import { PostNavigatorType } from "@/core/types/posts";
import { PoolNavigation } from "@/core/types/pools";
import { API } from "@/core/api";
import { lastFeedQuery } from "@/core/feedQuery";
import { PREFS_EVENT, readBrowserPref } from "@/core/browserPrefs";
import { CaretLeftIcon, CaretRightIcon } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  postId: number;
  poolId?: number;
  poolName?: string; // shown in the middle while stepping through a pool
  fullscreen?: boolean;
};

// position/total only exist inside a pool
type Adjacent = PostNavigatorType & { position?: number; total?: number };

const NO_NAV: Adjacent = { previousPostId: null, nextPostId: null };

export function useAdjacentPosts(postId: number, poolId?: number) {
  const [nav, setNav] = useState<Adjacent>(NO_NAV);

  useEffect(() => {
    let cancelled = false; // ignore a slow answer for the post we already left
    setNav(NO_NAV);

    // Inside a pool: step through the pool's order. Otherwise: the same search the feed showed
    // (Next = up the feed, newer by default)
    const path = poolId
      ? `/api/pools/${poolId}/navigate?${new URLSearchParams({ current: String(postId) })}`
      : `/api/posts/${postId}/navigate?${new URLSearchParams({ q: lastFeedQuery() })}`;

    API(path)
      .then((res) => (res.ok ? res.json() : NO_NAV))
      .then((data: PoolNavigation | PostNavigatorType) => { if (!cancelled) setNav(data); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [postId, poolId]);

  return nav;
}

export default function PostNavigator({ postId, poolId, poolName, fullscreen }: Props) {
  const router = useRouter();
  const { previousPostId, nextPostId, position, total } = useAdjacentPosts(postId, poolId);
  const [flipNavigators, setFlipNavigators] = useState(false);

  const isPool = !!poolId;
  const leftShowsPrevious = isPool ? true : flipNavigators;  // pool: prev on left; non-pool: flip decides
  const rightShowsNext   = isPool ? true : flipNavigators;   // pool: next on right; non-pool: flip decides

  // Only called for ids that exist (the buttons are disabled when there's nothing that way)
  const buildLink = (targetId: number | null) =>
    fullscreen
      ? (poolId ? `/post/${targetId}/fullscreen?pool=${poolId}` : `/post/${targetId}/fullscreen`)
      : (poolId ? `/post/${targetId}?pool=${poolId}` : `/post/${targetId}`);

  // Flip preference (non-pool only): read on mount, then follow changes (e.g. from the QuickMenu toggle)
  useEffect(() => {
    const sync = () => setFlipNavigators(!!readBrowserPref("flipNavigators", false));
    sync();
    window.addEventListener(PREFS_EVENT, sync);
    return () => window.removeEventListener(PREFS_EVENT, sync);
  }, []);

  // Arrow-key navigation that mirrors the button mapping
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // ignore when typing
      const el = e.target as HTMLElement | null;
      const typing =
        !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing) return;

      const go = (targetId: number | null) => {
        if (!targetId) return;
        router.push(buildLink(targetId));
      };

      if (e.key === "ArrowLeft") {
        go(leftShowsPrevious ? previousPostId : nextPostId);
      } else if (e.key === "ArrowRight") {
        go(rightShowsNext ? nextPostId : previousPostId);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [leftShowsPrevious, rightShowsNext, previousPostId, nextPostId, poolId, fullscreen, router]);

  // Helpers that always point outward; label/target chosen by pool vs flip rules
  const LeftButton = () => {
    // In pool: always PREVIOUS on left. Outside pool: flip decides.
    return leftShowsPrevious ? (
      <button
        disabled={!previousPostId}
        onClick={() => router.push(buildLink(previousPostId))}
        className="flex items-center cursor-pointer gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CaretLeftIcon size={28} weight="bold" />
        <span className="text-sm">Previous</span>
      </button>
    ) : (
      <button
        disabled={!nextPostId}
        onClick={() => router.push(buildLink(nextPostId))}
        className="flex items-center cursor-pointer gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CaretLeftIcon size={28} weight="bold" />
        <span className="text-sm">Next</span>
      </button>
    );
  };

  const RightButton = () => {
    // In pool: always NEXT on right. Outside pool: flip decides.
    return rightShowsNext ? (
      <button
        disabled={!nextPostId}
        onClick={() => router.push(buildLink(nextPostId))}
        className="flex items-center cursor-pointer gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="text-sm">Next</span>
        <CaretRightIcon size={28} weight="bold" />
      </button>
    ) : (
      <button
        disabled={!previousPostId}
        onClick={() => router.push(buildLink(previousPostId))}
        className="flex items-center cursor-pointer gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="text-sm">Previous</span>
        <CaretRightIcon size={28} weight="bold" />
      </button>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`relative w-full px-4 md:py-3 flex items-center justify-between ${
        fullscreen ? "bg-black/80 backdrop-blur sticky top-0 z-40 border-b border-zinc-800" : ""
      }`}
    >
      <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden">
        <LeftButton />
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden">
        <RightButton />
      </div>

      {poolId && poolName && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-subtle text-center truncate max-w-[40%]"
        >
          <span className="hidden sm:inline">Pool:{" "}</span>
          <Link href={`/pools/${poolId}`} className="text-accent hover:underline underline-offset-2">
            {poolName}
          </Link>
          {position !== undefined && total !== undefined && (
            <span className="ml-2 text-zinc-500 tabular-nums">{position} / {total}</span>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
