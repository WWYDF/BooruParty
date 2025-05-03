"use client";

import { PostNavigatorType } from "@/core/types/posts";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  postId: number;
  poolId?: number;
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


export default function PostNavigator({ postId, poolId }: Props) {
  const router = useRouter();
  const { previousPostId, nextPostId } = useAdjacentPosts(postId, poolId);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-between items-center w-full"
    >
      {poolId ? (
        <>
          <button
            disabled={!previousPostId}
            onClick={() => router.push(`/post/${previousPostId}?pool=${poolId}`)}
            className="flex items-center gap-1 text-subtle hover:text-accent disabled:opacity-40"
          >
            <CaretLeft size={28} weight="bold" />
            <span className="text-sm">Previous</span>
          </button>

          <button
            disabled={!nextPostId}
            onClick={() => router.push(`/post/${nextPostId}?pool=${poolId}`)}
            className="flex items-center gap-1 text-subtle hover:text-accent disabled:opacity-40"
          >
            <span className="text-sm">Next</span>
            <CaretRight size={28} weight="bold" />
          </button>
        </>
      ) : (
        <>
          <button
            disabled={!nextPostId}
            onClick={() => router.push(`/post/${nextPostId}`)}
            className="flex items-center gap-1 text-subtle hover:text-accent disabled:opacity-40"
          >
            <CaretLeft size={28} weight="bold" />
            <span className="text-sm">Next</span>
          </button>

          <button
            disabled={!previousPostId}
            onClick={() => router.push(`/post/${previousPostId}`)}
            className="flex items-center gap-1 text-subtle hover:text-accent disabled:opacity-40"
          >
            <span className="text-sm">Previous</span>
            <CaretRight size={28} weight="bold" />
          </button>
        </>
      )}
    </motion.div>
  );
}  