"use client";

import { use, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PostDetail } from "@/core/types/posts";
import { API } from "@/core/api";
import PostNavigator from "@/components/Posts/Individual/PostNavigator";
import { CaretDoubleLeftIcon } from "@phosphor-icons/react";

export default function PostFullscreenPage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  const router = useRouter();
  const searchParams = useSearchParams();
  const pool = searchParams.get("pool");
  const poolId = pool ? Number(pool) : undefined;

  const postLink = `/post/${id}${poolId ? `?pool=${poolId}` : ""}`;

  useEffect(() => {
    let cancelled = false; // ignore a slow answer for a post we already navigated away from
    setPost(null);
    setLoading(true);

    (async () => {
      try {
        const res = await API(`/api/posts/${id}`);
        if (cancelled) return;
        // The normal post page knows how to explain 401/403/404, so send them there
        if (!res.ok) return router.replace(postLink);
        setPost(await res.json());
      } catch {
        if (!cancelled) router.replace(postLink);
      }
    })();

    return () => { cancelled = true; };
  }, [id, postLink, router]);

  // Escape = back to the normal post page
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.replace(postLink);
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [router, postLink]);

  // Navigator bar only shows while the mouse is in the top 30% of the screen
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setVisible(e.clientY <= window.innerHeight * 0.3);
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Videos have no fullscreen view; their player has its own
  useEffect(() => {
    if (post?.type === "VIDEO") router.replace(postLink);
  }, [post, postLink, router]);

  if (!post || post.type === "VIDEO") return null;

  return (
    <motion.div
      className="min-h-screen w-full bg-black flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className={`static md:fixed top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-black transition-all duration-300 ${
          visible ? "md:opacity-100 md:translate-y-0" : "md:opacity-0 md:-translate-y-full"
        }`}
      >
        <PostNavigator
          postId={post.id}
          poolId={poolId}
          poolName={post.pools.find((p) => p.id === poolId)?.name}
          fullscreen
        />
      </div>

      <div className="relative w-full overflow-auto bg-black">
        {/* Dummy spacer: visible offset under the fixed navigator without layout shift */}
        <div className="sticky top-0 h-14 z-0" />

        {loading && (
          <div className="absolute z-50 flex items-center justify-center w-full h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent" />
          </div>
        )}

        {/* key: a fresh <img> per post, so onLoad fires again when navigating */}
        <motion.img
          key={post.id}
          src={post.originalPath}
          alt={`Post ${post.id}`}
          onLoad={() => setLoading(false)}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: loading ? 0.3 : 1 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        />
      </div>

      <div className="2xl:hidden bottom-0 w-full bg-black/90 backdrop-blur-sm z-50 border-t border-zinc-800 px-4 py-3">
        <button
          onClick={() => router.replace(postLink)}
          className="flex gap-2 items-center justify-center w-full py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 transition text-white font-medium cursor-pointer"
        >
          <CaretDoubleLeftIcon /> Return to Post
        </button>
      </div>
    </motion.div>
  );
}
