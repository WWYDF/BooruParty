"use client";

import { useState } from "react";
import PostVoting from "./PostVoting";
import { resolveFileType } from "@/core/dictionary";
import { Post, PostUserStatus } from "@/core/types/posts";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "../../Toast";

type Props = {
  post: Post;
  user?: PostUserStatus;
  showVoting?: boolean;
  skeletonAspectRatio?: number;
  disableFullscreen?: boolean;
};

const fastify = process.env.NEXT_PUBLIC_FASTIFY;

export default function PostDisplay({ post, user, showVoting = true, disableFullscreen = false }: Props) {
  const [showFull, setShowFull] = useState(post.previewScale === 100 || post.previewScale == null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = searchParams.get("pool");
  const toast = useToast();
  const [isAnimating, setIsAnimating] = useState(false);

  const fileType = resolveFileType(`.${post.fileExt}`);

  const fullSrc = `${fastify}/data/uploads/${fileType}/${post.id}.${post.fileExt}`;

  function handleFullscreen(toggle: boolean) {
    if (disableFullscreen == false) { setIsAnimating(toggle); }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <AnimatePresence>
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0.95, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {fileType === "video" ? (
            <video
              src={showFull ? fullSrc : post.previewPath}
              controls
              playsInline
              loop
              // muted
              preload="metadata"
              className="max-h-[75vh] w-auto h-auto object-contain rounded-xl"
            />
          ) : (
            <img
              loading="lazy"
              src={showFull ? fullSrc : post.previewPath}
              alt={`Error accessing ${fullSrc}`}
              title="Click to enter fullscreen mode"
              onClick={() => {
                handleFullscreen(true);
              }}
              className="w-full max-w-[90vw] min-w-[70vw] max-h-[70vh] h-auto object-contain rounded-xl cursor-pointer"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {!showFull && post.previewScale !== 100 && showVoting ? (
        <button
          onClick={() => setShowFull(true)}
          className="text-subtle text-sm italic"
        >
          Viewing sample resized to {post.previewScale}% of original (
          <span className="underline text-accent">view original</span>
          )
        </button>
      ) : null}

      {showVoting && user && user.signedIn == true && <PostVoting post={post} user={user} />}

      {isAnimating && (
        <motion.div
          className="fixed top-0 left-0 w-full h-full bg-black z-50"
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 1.1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          onAnimationComplete={() => {
            router.push(`/post/${post.id}/fullscreen${poolId ? `?pool=${poolId}` : ""}`);
            if (window.innerWidth >= 1280) {
              toast('Press ESC to exit', 'info');
            };
          }}
        />
      )}
    </div>
  );
}