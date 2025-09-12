"use client";

import { PostNavigatorType } from "@/core/types/posts";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  postId: number;
  poolId?: number;
  fullscreen?: boolean;
};

export function useAdjacentPosts(postId: number, poolId?: number) {
  const [nav, setNav] = useState<PostNavigatorType>({
    previousPostId: 0,
    nextPostId: 0,
  });

  useEffect(() => {
    async function fetchAdjacentPosts() {
      let res;
    
      if (poolId) {
        res = await fetch(`/api/pools/${poolId}/navigate?current=${postId}`, {
          cache: "no-store",
        });
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
    
        res = await fetch(`/api/posts/navigate?${params.toString()}`, {
          cache: "no-store",
        });
      }
    
      if (res?.ok) {
        const data = await res.json();
        setNav(data);
      }
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

  const buildLink = (targetId: number) => {
    if (fullscreen) {
      return poolId
        ? `/post/${targetId}/fullscreen?pool=${poolId}`
        : `/post/${targetId}/fullscreen`;
    } else {
      return poolId ? `/post/${targetId}?pool=${poolId}` : `/post/${targetId}`;
    }
  };

  // Load flip preference
  useEffect(() => {
    try {
      const saved = localStorage.getItem("browserPreferences");
      if (saved) {
        const prefs = JSON.parse(saved);
        setFlipNavigators(!!prefs.flipNavigators);
      }
    } catch {
      setFlipNavigators(false);
    }
  }, []);

  useEffect(() => {
    if (!poolId) return;
  
    fetch(`/api/pools/${poolId}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setPoolName(data?.name ?? null))
      .catch(() => setPoolName(null));
  }, [poolId]);

  // Left side button (always shows CaretLeft)
  const LeftButton = () => {
    // pool inverts default behavior
    const isPool = !!poolId;
    const showPrev = flipNavigators ? !isPool : isPool;

    if (showPrev) {
      return (
        <button
          disabled={!previousPostId}
          onClick={() => router.push(buildLink(previousPostId))}
          className="flex items-center gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <CaretLeft size={28} weight="bold" />
          <span className="text-sm">Previous</span>
        </button>
      );
    }
    return (
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

  // Right side button (always shows CaretRight)
  const RightButton = () => {
    const isPool = !!poolId;
    const showNext = flipNavigators ? !isPool : isPool;

    if (showNext) {
      return (
        <button
          disabled={!nextPostId}
          onClick={() => router.push(buildLink(nextPostId))}
          className="flex items-center gap-1 text-subtle hover:text-accent transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="text-sm">Next</span>
          <CaretRight size={28} weight="bold" />
        </button>
      );
    }
    return (
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
        fullscreen
          ? "bg-black/80 backdrop-blur sticky top-0 z-40 border-b border-zinc-800"
          : ""
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
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-subtle text-center truncate max-w-[60%]"
        >
          Pool:{" "}
          <a
            href={`/pools/${poolId}`}
            className="text-accent hover:underline underline-offset-2"
          >
            {poolName}
          </a>
        </motion.div>
      )}
    </motion.div>
  );
}
