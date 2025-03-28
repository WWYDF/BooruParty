"use client";

import { motion, AnimatePresence } from "framer-motion";

type ResolvedComment = {
  id: number;
  postId: number;
  content: string;
  createdAt: string;
  authorName: string;
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
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {comments.map((comment) => (
          <motion.div
            key={comment.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="bg-secondary p-3 rounded-xl text-sm text-subtle"
          >
            <div className="text-xs text-muted mb-1">
              {comment.authorName} · {new Date(comment.createdAt).toLocaleString()}
            </div>
            <p>{comment.content}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
