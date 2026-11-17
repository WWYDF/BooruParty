'use client';

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { API } from "@/core/api";
import { PostDetail } from "@/core/types/posts";

// Blurred, darkened backdrop from a post. Fetched as the viewer, so a post they can't see just means no background
export default function ProfileBackground({ postId }: { postId: number | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!postId) return;
    let cancelled = false;

    API(`/api/posts/${postId}`)
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const post: PostDetail = await res.json();
        if (!cancelled) setUrl(post.thumbnails.large); // blurred anyway, so the 800px thumbnail is plenty (and works for videos)
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [postId]);

  if (!url) return null;

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-0 scale-110 bg-cover bg-center bg-no-repeat blur-[3px]"
        style={{ backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${url})` }}
      />
    </div>
  );
}
