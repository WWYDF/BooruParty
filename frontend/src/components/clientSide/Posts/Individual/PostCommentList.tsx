"use client";

import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { ALLOWED_EMBED_SOURCES } from "@/core/dictionary";
import { Comments } from "@/core/types/comments";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { JSX } from "react";

function extractEmbedURLs(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const matches = content.match(urlRegex) || [];

  return matches.filter((url) => {
    try {
      const hostname = new URL(url).hostname;
      return Object.keys(ALLOWED_EMBED_SOURCES).some((domain) =>
        hostname.endsWith(domain)
      );
    } catch {
      return false;
    }
  });
}

function renderEmbeds(urls: string[]): JSX.Element[] {
  return urls.map((url) => {
    try {
      const parsed = new URL(url);
      const type = Object.entries(ALLOWED_EMBED_SOURCES).find(([domain]) =>
        parsed.hostname.endsWith(domain)
      )?.[1];

      if (!type) return null;

      if (type === "image") {
        return (
          <div key={url} className="mt-2">
            <img
              src={url}
              alt="Embedded media"
              className="rounded-lg max-w-xs max-h-64 object-contain"
            />
          </div>
        );
      }

      if (type === "iframe") {
        return (
          <div key={url} className="mt-2">
            <iframe
              src={url}
              className="w-full max-w-md h-64 rounded"
              allow="autoplay; encrypted-media"
              allowFullScreen
            />
          </div>
        );
      }
    } catch {
      return null;
    }
  }).filter(Boolean) as JSX.Element[];
}

export default function PostCommentList({
  comments,
  loading,
  error,
}: {
  comments: Comments[];
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
                <RoleBadge role={comment.author.role.name} />
                {" · "}


                {new Date(comment.createdAt).toLocaleString()}
              </div>
              <div className="text-base text-zinc-400 whitespace-pre-wrap">
              {(() => {
                const embedURLs = comment.isEmbed ? extractEmbedURLs(comment.content) : [];
                const visibleContent = embedURLs.reduce(
                  (text, url) => text.replace(url, "").trim(),
                  comment.content
                );

                return (
                  <div className="text-base text-zinc-400 whitespace-pre-wrap">
                    {visibleContent}
                    {comment.isEmbed && renderEmbeds(embedURLs)}
                  </div>
                );
              })()}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
