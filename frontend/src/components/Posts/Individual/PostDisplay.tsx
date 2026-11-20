"use client";

import { useEffect, useRef, useState } from "react";
import { PostDetail } from "@/core/types/posts";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/UI/Toast";
import PostVoting from "./PostVoting";

type Props = {
  post: PostDetail;
  onChange?: (patch: Partial<PostDetail>) => void; // set = show the vote/favorite buttons
  disableFullscreen?: boolean;
};

export default function PostDisplay({ post, onChange, disableFullscreen = false }: Props) {
  // No preview means the original was already the smallest version, so show it directly
  const [showFull, setShowFull] = useState(post.previewPath === null);
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = searchParams.get("pool");
  const toast = useToast();

  const imgRef = useRef<HTMLImageElement | null>(null);
  const src = showFull || !post.previewPath ? post.originalPath : post.previewPath;

  function handleFullscreen(toggle: boolean) {
    if (!disableFullscreen) setIsAnimating(toggle);
  }

  function viewOriginal() {
    setShowFull(true);
    window.dispatchEvent(new CustomEvent("post:changeViewingState", { detail: { state: true } }));
  }

  function publishDims(w: number, h: number) {
    // persist per-post so it survives refresh
    try {
      sessionStorage.setItem(`bp:dims:${post.id}`, JSON.stringify({ w, h, at: Date.now(), src }));
    } catch {}
    window.dispatchEvent(new CustomEvent("post:image-dimensions", { detail: { postId: post.id, w, h } }));
  }

  // A cached image can finish loading before React attaches onLoad, so check once after render too
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth && el.naturalHeight) {
      publishDims(el.naturalWidth, el.naturalHeight);
    }
  }, [showFull, post.id]);

  // If the preview file is missing or broken, fall back to the original instead of a broken image
  function handleError() {
    if (!showFull && post.previewPath) viewOriginal();
  }

  // Short silent clips behave like GIFs. Browsers only allow autoplay when the video is muted.
  const autoPlay = post.type === "VIDEO" && post.duration !== null && post.duration < 5 && !post.hasAudio;

  return (
    <div className="flex flex-col items-center gap-4">
      <AnimatePresence>
        <motion.div
          className="flex justify-center max-w-full"
          initial={{ opacity: 0.95, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {post.type === "VIDEO" ? (
            <video
              key={src} // remount when switching to the original so it actually reloads
              src={src}
              controls
              playsInline
              loop
              autoPlay={autoPlay}
              muted={autoPlay}
              preload="auto"
              poster={post.thumbnails.large}
              onLoadedMetadata={(e) => publishDims(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
              onError={handleError}
              className="min-w-[50vw] w-auto max-w-full max-h-[70vh] object-contain"
            />
          ) : (
            <img
              ref={imgRef}
              src={src}
              alt={`Post #${post.id}`}
              title="Click to enter fullscreen mode"
              onClick={() => handleFullscreen(true)}
              onLoad={(e) => publishDims(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
              onError={handleError}
              // Reserves the right amount of space before the image loads, so the page doesn't jump
              className="lg:max-h-[80vh] lg:h-[80vh] w-auto max-w-full object-contain rounded-xl cursor-pointer"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {!showFull && post.previewSize !== null && (
        <button onClick={viewOriginal} className="text-subtle text-sm italic">
          Viewing sample encoded to {Math.round((post.previewSize / post.fileSize) * 100)}% of original (
          <span className="underline text-accent cursor-pointer">view original</span>
          )
        </button>
      )}

      {onChange && <PostVoting post={post} onChange={onChange} />}

      {isAnimating && (
        <motion.div
          className="fixed top-0 left-0 w-full h-full bg-black z-50"
          initial={{ scale: 0.1, opacity: 0 }}
          animate={{ scale: 1.1, opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          onAnimationComplete={() => {
            router.push(`/post/${post.id}/fullscreen${poolId ? `?pool=${poolId}` : ""}`);
            if (window.innerWidth >= 1280) toast("Press ESC to exit", "info");
          }}
        />
      )}
    </div>
  );
}
