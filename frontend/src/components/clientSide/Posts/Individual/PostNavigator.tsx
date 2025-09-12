"use client";

import { PostNavigatorType } from "@/core/types/posts";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = { postId: number; poolId?: number; fullscreen?: boolean };

export function useAdjacentPosts(postId: number, poolId?: number) {
  const [nav, setNav] = useState<PostNavigatorType>({ previousPostId: 0, nextPostId: 0 });

  useEffect(() => {
    async function fetchAdjacentPosts() {
      let res;
      if (poolId) {
        res = await fetch(`/api/pools/${poolId}/navigate?current=${postId}`, { cache: "no-store" });
      } else {
        const saved = JSON.parse(localStorage.getItem("lastSearchParams") ?? "{}");
        const query = saved.query ?? "";
        const safety = saved.safety ?? "";
        const sort = saved.sort ?? "new";
        const params = new URLSearchParams({
          current: postId.toString(),
          ...(query && { query }),
          ...(safety && { safety }),
          ...(sort && { sort }),
        });
        res = await fetch(`/api/posts/navigate?${params.toString()}`, { cache: "no-store" });
      }
      if (res?.ok) setNav(await res.json());
    }
    fetchAdjacentPosts();
  }, [postId, poolId]);

  return nav;
}

export default function PostNavigator({ postId, poolId, fullscreen }: Props) {
  const router = useRouter();
  const { previousPostId, nextPostId } = useAdjacentPosts(postId, poolId);
  const [poolName, setPoolName] = useState<string | null>(null);
  const [flipNavigators, setFlipNavigators] = useState(false);

  const buildLink = (targetId: number) =>
    fullscreen
      ? (poolId ? `/post/${targetId}/fullscreen?pool=${poolId}` : `/post/${targetId}/fullscreen`)
      : (poolId ? `/post/${targetId}?pool=${poolId}` : `/post/${targetId}`);

  // load flip preference (non-pool only)
  useEffect(() => {
    try {
      const saved = localStorage.getItem("browserPreferences");
      if (saved) setFlipNavigators(!!JSON.parse(saved).flipNavigators);
    } catch {
      setFlipNavigators(false);
    }
  }, []);

  useEffect(() => {
    if (!poolId) return;
    fetch(`/api/pools/${poolId}`, { cache: "no-store" })
      .then(res => (res.ok ? res.json() : null))
      .then(data => setPoolName(data?.name ?? null))
      .catch(() => setPoolName(null));
  }, [poolId]);

  // Helpers that always point outward; label/target chosen by pool vs flip rules
  const LeftButton = () => {
    const isPool = !!poolId;
    // In pool: always PREVIOUS on left. Outside pool: flip decides.
    const showPrevious = isPool ? true : flipNavigators; // if not pool: true when flipped
    return showPrevious ? (
      <button
        disabled={!previousPostId}
        onClick={() => router.push(buildLink(previousPostId))}
        className="flex items-center gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CaretLeft size={28} weight="bold" />
        <span className="text-sm">Previous</span>
      </button>
    ) : (
      <button
        disabled={!nextPostId}
        onClick={() => router.push(buildLink(nextPostId))}
        className="flex items-center gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <CaretLeft size={28} weight="bold" />
        <span className="text-sm">Next</span>
      </button>
    );
  };

  const RightButton = () => {
    const isPool = !!poolId;
    // In pool: always NEXT on right. Outside pool: flip decides.
    const showNext = isPool ? true : flipNavigators; // if not pool: true when flipped
    return showNext ? (
      <button
        disabled={!nextPostId}
        onClick={() => router.push(buildLink(nextPostId))}
        className="flex items-center gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="text-sm">Next</span>
        <CaretRight size={28} weight="bold" />
      </button>
    ) : (
      <button
        disabled={!previousPostId}
        onClick={() => router.push(buildLink(previousPostId))}
        className="flex items-center gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <span className="text-sm">Previous</span>
        <CaretRight size={28} weight="bold" />
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
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-subtle text-center truncate max-w=[60%]"
        >
          Pool:{" "}
          <a href={`/pools/${poolId}`} className="text-accent hover:underline underline-offset-2">
            {poolName}
          </a>
        </motion.div>
      )}
    </motion.div>
  );
}
