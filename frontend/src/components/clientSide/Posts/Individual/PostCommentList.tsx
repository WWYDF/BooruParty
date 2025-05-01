"use client";

import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { ALLOWED_EMBED_SOURCES } from "@/core/dictionary";
import { Comments } from "@/core/types/comments";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { JSX } from "react";

type ExtractedEmbed = 
  | { type: "url"; value: string }
  | { type: "post"; postId: number; inline: boolean };

function extractEmbeds(content: string): ExtractedEmbed[] {
  const embeds: ExtractedEmbed[] = [];

  const urlRegex = /https?:\/\/[^\s]+/g;
  const postRegex = /:(\d+):/g;

  const urlMatches = content.match(urlRegex) || [];
  for (const url of urlMatches) {
    try {
      const hostname = new URL(url).hostname;
      if (Object.keys(ALLOWED_EMBED_SOURCES).some((d) => hostname.endsWith(d))) {
        embeds.push({ type: "url", value: url });
      }
    } catch {}
  }

  let match;
  while ((match = postRegex.exec(content)) !== null) {
    const postId = parseInt(match[1]);
    if (!isNaN(postId)) {
      // Check if the entire content is just ":<id>:" (no other text)
      const isAlone = content.trim() === match[0];
      embeds.push({ type: "post", postId, inline: !isAlone });
    }
  }

  return embeds;
}

function renderEmbeds(embeds: ExtractedEmbed[]): JSX.Element[] {
  return embeds.map((embed, index) => {
    if (embed.type === "url") {
      try {
        const parsed = new URL(embed.value);
        const type = Object.entries(ALLOWED_EMBED_SOURCES).find(([domain]) =>
          parsed.hostname.endsWith(domain)
        )?.[1];

        if (!type) return null;

        if (type === "image") {
          return (
            <div key={index} className="mt-2">
              <img
                src={embed.value}
                alt="Embedded media"
                className="rounded-lg max-w-xs max-h-64 object-contain"
              />
            </div>
          );
        }

        if (type === "iframe") {
          return (
            <div key={index} className="mt-2">
              <iframe
                src={embed.value}
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
    }

    if (embed.type === "post") {
      const thumbnailUrl = `${process.env.NEXT_PUBLIC_FASTIFY}/data/thumbnails/${embed.postId}_small.webp`;
      return (
        <div key={index} className="mt-2">
          <a href={`/post/${embed.postId}`} className="block max-w-xs rounded-lg overflow-hidden border border-zinc-700 hover:border-accent transition">
            <img
              src={thumbnailUrl}
              alt={`Post #${embed.postId}`}
              className="w-full object-cover"
            />
          </a>
        </div>
      );
    }

    return null;
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
                  href={`/users/${encodeURIComponent(comment.author.username)}`}
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
                const embeds = comment.isEmbed ? extractEmbeds(comment.content) : [];

                const visibleContent = embeds.reduce((text, embed) => {
                  if (embed.type === "url") {
                    return text.replace(embed.value, "").trim();
                  } else if (embed.type === "post" && !embed.inline) {
                    return text.replace(`:${embed.postId}:`, "").trim();
                  }
                  return text;
                }, comment.content);

                return (
                  <div className="text-base text-zinc-400 whitespace-pre-wrap">
                    {visibleContent.split(/(:\d+:)/g).map((chunk, idx) => {
                      const match = chunk.match(/^:(\d+):$/);
                      if (match) {
                        const id = parseInt(match[1]);
                        const isInline = embeds.some(
                          (e) => e.type === "post" && e.postId === id && e.inline
                        );
                        if (isInline) {
                          return (
                            <a
                              key={idx}
                              href={`/post/${id}`}
                              className="text-accent hover:underline"
                            >
                              {id}
                            </a>
                          );
                        }
                      }
                      return <span key={idx}>{chunk}</span>;
                    })}
                    {comment.isEmbed && renderEmbeds(embeds)}
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
