"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

type ResolvedComment = {
  id: number;
  postId: number;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    role: string;
    avatar: string
  }
};

export default function PostCommentList({
  comments,
  loading,
  error,
}: {
  comments: ResolvedComment[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return null;
  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>;
  if (!comments.length) return <p className="text-subtle text-sm italic">No comments yet.</p>;

  return (
    <div className="space-y-4">
      <AnimatePresence initial={false}>
        {comments.map((comment) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex gap-4 items-start bg-secondary p-4 rounded-2xl"
          >
            {/* Avatar */}
            <div className="flex-shrink-0">
              {comment.author.avatar ? (
                <img
                  src={comment.author.avatar}
                  alt={comment.author.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-secondary-border flex items-center justify-center text-subtle text-xs">
                  ?
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1">
              <div className="text-muted text-sm mb-1 text-zinc-400">
              <Link
                href={`/posts?query=submit:${encodeURIComponent(comment.author.username)}`}
                className="text-accent hover:underline"
              >
                <span>{comment.author.username}</span>
              </Link>

                {" · "}
                {new Date(comment.createdAt).toLocaleString()}
              </div>
              <p className="text-base text-zinc-400">{comment.content}</p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
