"use client";

import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { ALLOWED_EMBED_SOURCES } from "@/core/dictionary";
import { Comments } from "@/core/types/comments";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowFatDown, ArrowFatUp, Trash, PencilSimple, Check, X } from "phosphor-react";
import { JSX, useEffect, useState } from "react";
import { useToast } from "../../Toast";
import clsx from "clsx";
import ConfirmModal from "../../ConfirmModal";
import sanitizeHtml from "sanitize-html";

type ExtractedEmbed =
  | { type: "url"; value: string }
  | {
      type: "post";
      postId: number;
      inline: boolean;
      previewPath: string;
      safety: "SAFE" | "SKETCHY" | "UNSAFE";
      shouldBlur: boolean;
    };

type PreviewData = {
  previewPath: string;
  safety: "SAFE" | "SKETCHY" | "UNSAFE";
};


function extractEmbeds(
  content: string,
  previewMap: Record<number, { previewPath: string; safety: "SAFE" | "SKETCHY" | "UNSAFE" }>,
  blurUnsafeEmbeds: boolean,
  parentPostSafety: "SAFE" | "SKETCHY" | "UNSAFE"
): ExtractedEmbed[] {
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
      const postData = previewMap[postId];
      const previewPath = postData?.previewPath ?? `${process.env.NEXT_PUBLIC_FASTIFY}/data/thumbnails/${postId}_small.webp`;
      const safety = postData?.safety ?? "SAFE";
      embeds.push({
        type: "post",
        postId,
        inline: !isAlone,
        previewPath,
        safety,
        shouldBlur:
          blurUnsafeEmbeds &&
          parentPostSafety === "SAFE" &&
          safety === "UNSAFE",
      });
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
                className="rounded-lg max-w-1/2 max-h-64 object-contain"
              />
            </div>
          );
        }

        if (type === "iframe") {
          return (
            <div key={index} className="mt-2">
              <iframe
                src={embed.value}
                className="w-full max-w-1/2 h-64 rounded"
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
      return (
        <div key={index} className="mt-2">
          <a href={`/post/${embed.postId}`} className="block max-w-xs rounded-lg overflow-hidden border border-secondary-border hover:border-darkerAccent transition">
            <img
              src={embed.previewPath}
              alt={`Post #${embed.postId}`}
              title={`Post #${embed.postId} from ${embed.previewPath}`}
              className={clsx(
                "w-full object-cover rounded-lg transition duration-300",
                embed.shouldBlur && "blur-md hover:blur-none"
              )}
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
  blurUnsafeEmbeds,
  parentPostSafety,
  canVoteOnComments
}: {
  comments: Comments[];
  loading: boolean;
  error: string | null;
  blurUnsafeEmbeds: boolean;
  parentPostSafety: "SAFE" | "SKETCHY" | "UNSAFE";
  canVoteOnComments: boolean;
}) {
  if (loading) return null;
  if (error) return <p className="text-red-500 text-sm">Error: {error}</p>;
  if (!comments.length) return <p className="text-subtle text-sm italic">No comments yet.</p>;

  const referencedPostIds = Array.from(
    new Set(
      comments.flatMap(comment =>
        Array.from(comment.content.matchAll(/:(\d+):/g)).map(([, id]) => parseInt(id))
      )
    )
  ).filter(Boolean);  

  const router = useRouter();
  const toast = useToast();
  const [previewMap, setPreviewMap] = useState<Record<number, PreviewData>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<number | null>(null);

  console.log(`Voting: ${canVoteOnComments}`)


  useEffect(() => {
    if (referencedPostIds.length === 0) return;
  
    const loadPreviews = async () => {
      const res = await fetch(`/api/posts/previews?ids=${referencedPostIds.join(",")}`);
      const data = await res.json();
      setPreviewMap(
        Object.fromEntries(
          data.map((post: PreviewData & { id: number }) => [
            post.id,
            { previewPath: post.previewPath, safety: post.safety },
          ])
        )
      );
    };
  
    loadPreviews();
  }, [comments]);

  const handleVote = async (commentId: number, vote: 1 | 0 | -1) => {
    const current = comments.find(c => c.id === commentId); // Find comment interacted with
    if (!current) return;

    const newVote = current.userVote === vote ? 0 : vote;;

    const res = await fetch(`/api/comments/${commentId}/vote`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ vote: newVote }),
    });
    
    if (!res.ok) {
      const data = await res.json();
      if (data?.error?.toLowerCase().includes("unauthorized")) {
        toast("You must be logged in to vote.", "error");
      } else {
        toast("Failed to vote.", "error");
      }
      return;
    }
  
    router.refresh();
  };

  const handleSaveEdit = async (commentId: number) => {
    if (!editContent.trim()) {
      toast("Comment cannot be empty", "error");
      return;
    }
  
    const res = await fetch(`/api/comments/${commentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: editContent }),
    });
  
    if (!res.ok) {
      toast("Failed to update comment", "error");
    } else {
      toast("Comment updated!", "success");
      setEditingId(null);
      router.refresh();
    }
  };  
  
  const handleDelete = (commentId: number) => {
    setCommentToDelete(commentId);
    setShowConfirm(true);
  };
    

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
            className="flex gap-4 bg-secondary p-4 rounded-2xl"
          >
            {/* Avatar */}
            <div className="flex gap-4 w-full">
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
                <div className="text-muted text-sm mb-1 text-zinc-400 overflow-hidden break-all">
                  <Link
                    href={`/users/${encodeURIComponent(comment.author.username)}`}
                    className="text-accent hover:underline"
                  >
                    <span>{comment.author.username}</span>
                  </Link>
                  <RoleBadge role={comment.author.role} />

                  <a className="ml-1 text-xs text-zinc-500">
                    {new Date(comment.createdAt).toLocaleString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </a>
                </div>
                <div className="text-base text-zinc-400 whitespace-pre-wrap break-all">
                {(() => {
                  const embeds = comment.isEmbed
                  ? extractEmbeds(comment.content, previewMap, blurUnsafeEmbeds, parentPostSafety)
                  : [];

                  const visibleContent = embeds.reduce((text, embed) => {
                    if (embed.type === "url") {
                      return text.replace(embed.value, "").trim();
                    } else if (embed.type === "post" && !embed.inline) {
                      return text.replace(`:${embed.postId}:`, "").trim();
                    }
                    return text;
                  }, comment.content);

                  return editingId === comment.id ? (
                    <div className="space-y-2 mt-1">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-sm text-white resize-none  focus:outline-none focus:ring-1 focus:ring-zinc-700"
                        rows={4}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(comment.id)}
                          className="text-green-400 hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          <Check size={14} weight="bold" />
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-zinc-400 hover:underline inline-flex items-center gap-1 text-xs"
                        >
                          <X size={14} weight="bold" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                  <>
                    <div className="text-base text-zinc-400 whitespace-pre-wrap break-all">
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
                        return (
                          <span
                            key={idx}
                            className="break-all"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeHtml(chunk, {
                                allowedTags: [], // no tags allowed at all
                                allowedAttributes: {}, // no attributes allowed
                              }),
                            }}
                          />
                        );
                      })}
                      {comment.isEmbed && renderEmbeds(embeds)}
                    </div>
                  </>
                );
                })()}
                </div>
                <div className="flex gap-2 text-2xs mt-1 text-zinc-600 overflow-hidden break-all">
                  {comment.canEdit && (
                    <button
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditContent(comment.content);
                      }}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      Edit
                    </button>
                  )}
                  {comment.canDelete && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {/* Voting Column */}
              <div className="flex flex-col items-center pr-1 pt-1">
                {canVoteOnComments ? (
                  <>
                    <button onClick={() => handleVote(comment.id, 1)}>
                      <ArrowFatUp
                        size={16}
                        weight={comment.userVote === 1 ? "fill" : "bold"}
                        className={clsx(
                          "transition lg:hover:text-white",
                          comment.userVote === 1 ? "text-accent" : "text-subtle"
                        )}
                      />
                    </button>

                    <div className="h-full flex items-center justify-center">
                      <span
                        className={clsx(
                          "text-xs font-medium",
                          comment.score > 0
                            ? "text-accent"
                            : comment.score < 0
                            ? "text-red-500"
                            : "text-subtle"
                        )}
                        title={`This comment has ${comment.score} vote(s).`}
                      >
                        {comment.score}
                      </span>
                    </div>

                    <button onClick={() => handleVote(comment.id, -1)}>
                      <ArrowFatDown
                        size={16}
                        weight={comment.userVote === -1 ? "fill" : "bold"}
                        className={clsx(
                          "transition lg:hover:text-white",
                          comment.userVote === -1 ? "text-red-500" : "text-subtle"
                        )}
                      />
                    </button>
                  </>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <span
                      className={clsx(
                        "text-xs font-medium px-2 py-0.5 rounded bg-zinc-900",
                        comment.score > 0
                          ? "text-green-400"
                          : comment.score < 0
                          ? "text-red-400"
                          : "text-subtle"
                      )}
                      title={`This comment has ${comment.score} vote(s).`}
                    >
                      {comment.score}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <ConfirmModal
        open={showConfirm}
        onClose={() => {
          setShowConfirm(false);
          setCommentToDelete(null);
        }}
        onConfirm={async () => {
          if (!commentToDelete) return;

          const res = await fetch(`/api/comments/${commentToDelete}`, {
            method: "DELETE",
          });

          if (!res.ok) {
            toast("Failed to delete comment", "error");
          } else {
            toast("Comment deleted!", "success");
            router.refresh();
          }

          setShowConfirm(false);
          setCommentToDelete(null);
        }}
        title="Delete Comment?"
        description="Are you sure you want to delete this comment? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
