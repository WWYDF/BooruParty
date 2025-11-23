"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Post } from "@/core/types/posts";
import { resolveFileType } from "@/core/dictionary";
import PostNavigator from "@/components/clientSide/Posts/Individual/PostNavigator";
import { CaretDoubleLeft } from "phosphor-react";

export default function PostFullscreenPage(props: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    props.params.then(p => setId(p.id));
  }, [props.params]);

  const poolId = searchParams.get("pool");

  // Always declare hooks before returning JSX
  useEffect(() => {
    if (!id) return;

    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${id}`);
        if (!res.ok) throw new Error("Failed to fetch post");
        const data = await res.json();
        setPost(data.post);
      } catch {
        router.push("/post");
      }
    };

    fetchPost();
  }, [id, router]);
  

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && post?.id) {
        const target = poolId
          ? `/post/${post.id}?pool=${poolId}`
          : `/post/${post.id}`;
        router.replace(target);
      }
    };
  
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [router, post?.id, poolId]);


  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const y = e.clientY;
      const threshold = window.innerHeight * 0.3;
      setVisible(y <= threshold);
    };
  
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    if (!post) return;

    const fileType = resolveFileType(`.${post.fileExt}`);
    if (fileType === "video") {
      router.replace(`/post/${post.id}`);
    }
  }, [post, router]);

  if (!post) return null;

  const fileType = resolveFileType(`.${post.fileExt}`);
  if (fileType === "video") { return null } // redirect already kicked off above, so prevent rendering anything here

  return (
    <motion.div
      className="min-h-screen w-full bg-black flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div
        className={`top-0 left-0 right-0 z-50 border-b border-zinc-800 bg-black transition-all duration-300
          md:fixed md:${visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-full"}
          static`}
      >
        <PostNavigator postId={post.id} poolId={poolId ? parseInt(poolId) : undefined} fullscreen />
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-auto bg-black"
      >
        {/* This dummy spacer creates visible offset without layout shift */}
        <div className="sticky top-0 h-[56px] z-0" />

        {loading && (
          <div className="absolute z-50 flex items-center justify-center w-full h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent" />
          </div>
        )}

        <motion.img
          src={post.originalPath}
          alt={`Post ${post.id}`}
          onLoad={() => setLoading(false)}
          initial={{ opacity: 0.3 }}
          animate={{ opacity: loading ? 0.3 : 1 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        />
      </div>

        {post?.id && (
          <div className="2xl:hidden bottom-0 w-full bg-black/90 backdrop-blur-sm z-50 border-t border-zinc-800 px-4 py-3">
            <button
              onClick={() =>
                router.replace(poolId
                  ? `/post/${post.id}?pool=${poolId}`
                  : `/post/${post.id}`)
              }
              className="flex gap-2 items-center justify-center w-full py-2 rounded-xl bg-zinc-950 hover:bg-zinc-900 transition text-white font-medium"
            >
              <CaretDoubleLeft /> Return to Post
            </button>
          </div>
        )}
    </motion.div>
  );
}
