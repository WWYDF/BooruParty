"use client";

import { useEffect, useRef, useState } from "react";
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

export default function PostDisplay({ post, user, showVoting = true, disableFullscreen = false }: Props) {
  const [showFull, setShowFull] = useState(post.previewScale === 100 || post.previewScale == null);
  const [isAnimating, setIsAnimating] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const poolId = searchParams.get("pool");
  const toast = useToast();

  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileType = resolveFileType(`.${post.fileExt}`);

  function handleFullscreen(toggle: boolean) {
    if (disableFullscreen == false) { setIsAnimating(toggle); }
  }

  async function getImageSizeBytes(url: string): Promise<number | null> {
    try {
      const res = await fetch(url, { method: "HEAD" });
      const size = res.headers.get("Content-Length");
      return size ? parseInt(size, 10) : null;
    } catch {
      return null;
    }
  }
  
  function saveDims(w: number, h: number) {
    // persist per-post so it survives refresh
    try {
      sessionStorage.setItem(`bp:dims:${post.id}`, JSON.stringify({ w, h, at: Date.now(), src: showFull ? post.originalPath : post.previewPath }));
    } catch {}
  }
  
  function publishDims(w: number, h: number) {
    saveDims(w, h);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("post:image-dimensions", { detail: { postId: post.id, w, h } }));
    }
  }
  
  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth, naturalHeight, currentSrc } = e.currentTarget;
    publishDims(naturalWidth, naturalHeight);
  }

  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth && el.naturalHeight) {
      publishDims(el.naturalWidth, el.naturalHeight);
    }
  }, [showFull, post.id]);

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
              src={showFull ? post.originalPath : post.previewPath}
              controls
              playsInline
              loop
              // muted
              preload="metadata"
              onLoadedMetadata={(e) => publishDims(e.currentTarget.videoWidth, e.currentTarget.videoHeight)}
              className="min-w-[50vw] w-auto max-w-auto max-h-[70vh] object-contain"
            />
          ) : (
            <img
              ref={imgRef}
              loading="lazy"
              src={showFull ? post.originalPath : post.previewPath}
              alt={`Error accessing ${post.originalPath}`}
              title="Click to enter fullscreen mode"
              onClick={() => { handleFullscreen(true); }}
              onLoad={handleImageLoad}
              className="lg:max-h-[80vh] lg:h-[80vh] w-auto object-contain rounded-xl cursor-pointer"
            />
          )}
        </motion.div>
      </AnimatePresence>

      {!showFull && post.previewScale !== 100 && showVoting ? (
        <button
          onClick={() => {
            setShowFull(true);
            window.dispatchEvent(new CustomEvent("post:changeViewingState", { detail: { state: true } }));
          }}
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