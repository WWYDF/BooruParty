"use client";

type Props = {
  postId: number;
};

export default function PostVoting({ postId }: Props) {
  // Real logic coming later — for now this is static
  return (
    <div className="flex justify-center gap-4">
      <button className="px-3 py-1 rounded-xl bg-secondary-border text-subtle hover:text-accent transition">⬆ Upvote</button>
      <button className="px-3 py-1 rounded-xl bg-secondary-border text-subtle hover:text-accent transition">⬇ Downvote</button>
      <button className="px-3 py-1 rounded-xl bg-secondary-border text-subtle hover:text-accent transition">⭐ Favorite</button>
    </div>
  );
}
