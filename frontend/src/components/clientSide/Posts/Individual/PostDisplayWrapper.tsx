"use client";

import dynamic from "next/dynamic";
import { Post, PostUserStatus } from "@/core/types/posts";

// Inline skeleton placeholder
function PostDisplaySkeleton({ aspectRatio }: { aspectRatio: number }) {
  return (
    <div className="flex justify-center px-4">
      <div
        className="w-full max-w-screen-xl bg-zinc-800 animate-pulse rounded-xl"
        style={{ aspectRatio }}
      />
    </div>
  );
}

const PostDisplay = dynamic(() => import("./PostDisplay"), {
  loading: () => <PostDisplaySkeleton aspectRatio={1.777} />, // default/fallback value
});

export default function PostDisplayWrapper({
  post,
  user,
}: {
  post: Post;
  user?: PostUserStatus;
  showVoting?: boolean;
}) {
  return (
    <PostDisplay
      post={post}
      user={user}
    />
  );
}
