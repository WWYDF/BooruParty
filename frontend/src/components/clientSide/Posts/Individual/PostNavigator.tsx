"use client";

import { PostNavigatorType } from "@/core/types/posts";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Props = {
  postId: number;
};

export function useAdjacentPosts(postId: number) {
  const [nav, setNav] = useState<PostNavigatorType>({
    previousPostId: 0,
    nextPostId: 0,
  });

  useEffect(() => {
    async function fetchAdjacentPosts() {
      const saved = JSON.parse(localStorage.getItem("lastSearchParams") ?? "{}");
      const query = saved.query ?? ""; // ✅ use 'query', not 'tags'
      const safety = saved.safety ?? "";
      const sort = saved.sort ?? "new";

      const params = new URLSearchParams({
        current: postId.toString(),
        ...(query && { query }),   // ✅ send as 'query'
        ...(safety && { safety }),
        ...(sort && { sort }),
      });

      const res = await fetch(`/api/posts/navigate?${params.toString()}`, {
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        setNav(data);
      }
    }

    fetchAdjacentPosts();
  }, [postId]);

  return nav;
}


export default function PostNavigator({ postId }: Props) {
  const router = useRouter();
  const { previousPostId, nextPostId } = useAdjacentPosts(postId);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex justify-between items-center w-full"
    >
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
    </motion.div>
  );
}