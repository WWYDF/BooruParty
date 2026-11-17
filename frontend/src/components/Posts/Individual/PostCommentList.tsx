"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PencilSimpleIcon, TrashIcon } from "@phosphor-icons/react";
import { RoleBadge } from "@/components/RoleBadge";
import Button from "@/components/UI/Button";
import ConfirmModal from "@/components/UI/Modals/ConfirmModal";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import { API, errorText } from "@/core/api";
import { defaultAvatar } from "@/core/constants/defaults";
import { CommentWriteResponse, EmbeddedPosts, PostComment } from "@/core/types/comments";
import { Safety } from "@/core/types/posts";
import { MAX_COMMENT_LENGTH } from "./PostCommentForm";

type Props = {
  comments: PostComment[];
  embeddedPosts: EmbeddedPosts;
  parentSafety: Safety;                               // embeds "spicier" than this post get blurred until hovered
  onUpdated: (result: CommentWriteResponse) => void;  // after a successful edit
  onDeleted: (commentId: number) => void;
};

const SAFETY_RANK: Record<Safety, number> = { SAFE: 0, QUESTIONABLE: 1, EXPLICIT: 2 };

// Tokens worth turning into something: post embeds, links, @mentions. Everything else stays plain text.
const TOKEN = /:(\d{1,10}):|(https?:\/\/[^\s<>"']+)|(?<![\w@])@([A-Za-z0-9_]{2,32})/g;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The comment's text as React nodes. Embeds the server recognised are left out here (they render as cards below).
// Plain text only: content is never treated as HTML.
function renderText(comment: PostComment): React.ReactNode[] {
  const { content, embeds } = comment;
  const nodes: React.ReactNode[] = [];
  let last = 0;

  for (const m of content.matchAll(TOKEN)) {
    const start = m.index ?? 0;
    if (start > last) nodes.push(content.slice(last, start));
    last = start + m[0].length;

    const [token, postId, url, mention] = m;

    if (postId !== undefined && embeds.postIds.includes(Number(postId))) continue; // shown as a card
    if (url !== undefined && embeds.media.includes(url)) continue;                // shown as an image

    if (url !== undefined) {
      nodes.push(
        <a key={start} href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline break-all">
          {url}
        </a>,
      );
    } else if (mention !== undefined) {
      nodes.push(
        <Link key={start} href={`/users/${encodeURIComponent(mention)}`} className="text-accent hover:underline">
          @{mention}
        </Link>,
      );
    } else {
      nodes.push(token); // e.g. ":0:", or a post id the server didn't treat as an embed
    }
  }
  if (last < content.length) nodes.push(content.slice(last));

  // Removing embeds can leave blank edges ("look :5:" -> "look "); trim the ends
  if (typeof nodes[0] === "string") nodes[0] = nodes[0].trimStart();
  const end = nodes.length - 1;
  if (typeof nodes[end] === "string") nodes[end] = (nodes[end] as string).trimEnd();
  return nodes;
}

export default function PostCommentList({ comments, embeddedPosts, parentSafety, onUpdated, onDeleted }: Props) {
  const { user } = useUser();
  const toast = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const hasPerm = (perm: string) => user?.permissions.includes(perm) ?? false;
  // Same rule as the API: "others" covers your own too
  const can = (action: "edit" | "delete", comment: PostComment) =>
    hasPerm(`comment.${action}.others`) || (user?.id === comment.author.id && hasPerm(`comment.${action}.own`));

  const startEdit = (comment: PostComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const saveEdit = async (commentId: number) => {
    if (!editContent.trim()) {
      toast("A comment can't be empty. Delete it instead.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await API(`/api/comments/${commentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(errorText(data), "error");
        return;
      }
      setEditingId(null);
      onUpdated(data as CommentWriteResponse);
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    const id = deleteId;
    setDeleteId(null);
    if (id === null) return;
    try {
      const res = await API(`/api/comments/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast(errorText(await res.json().catch(() => ({}))), "error");
        return;
      }
      onDeleted(id);
      toast("Comment deleted", "success");
    } catch {
      toast("The server could not be reached", "error");
    }
  };

  if (!comments.length) return <p className="text-sm text-subtle">No comments yet.</p>;

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {comments.map((comment) => {
          const editing = editingId === comment.id;
          const text = renderText(comment);
          const hasText = text.some((n) => typeof n !== "string" || n.trim() !== "");

          return (
            <motion.div
              key={comment.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="flex gap-3 rounded-2xl bg-secondary p-4"
            >
              <img src={defaultAvatar} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />

              <div className="min-w-0 flex-1">
                {/* Header */}
                <div className="mb-1 flex flex-wrap items-center gap-x-2 text-sm">
                  <Link href={`/users/${encodeURIComponent(comment.author.username)}`} className="text-accent hover:underline">
                    {comment.author.username}
                  </Link>
                  <RoleBadge role={comment.author.role} />
                  <span className="text-xs text-zinc-500">{formatDate(comment.createdAt)}</span>
                  {comment.editedAt && (
                    <span className="text-xs text-zinc-600" title={`Edited ${formatDate(comment.editedAt)}`}>(edited)</span>
                  )}
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveEdit(comment.id); }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      rows={4}
                      maxLength={MAX_COMMENT_LENGTH}
                      autoFocus
                      className="w-full resize-y rounded-lg border border-secondary-border bg-zinc-900 p-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="success" loading={saving} onClick={() => saveEdit(comment.id)}>Save</Button>
                      <Button size="sm" disabled={saving} onClick={() => setEditingId(null)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {hasText && (
                      <p className="whitespace-pre-wrap wrap-break-word text-sm text-zinc-300">{text}</p>
                    )}

                    {/* GIFs / images from allowed hosts */}
                    {comment.embeds.media.map((url) => (
                      <img
                        key={url}
                        src={url}
                        alt="Embedded media"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="mt-2 max-h-64 max-w-full rounded-lg object-contain"
                      />
                    ))}

                    {/* Embedded posts */}
                    {comment.embeds.postIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {comment.embeds.postIds.map((id) => {
                          const embedded = embeddedPosts[id];
                          if (!embedded) {
                            // Deleted or hidden from this viewer; deliberately the same message for both
                            return (
                              <div key={id} className="flex h-24 w-24 items-center justify-center rounded-lg border border-dashed border-secondary-border text-center text-xs text-zinc-500">
                                Post unavailable
                              </div>
                            );
                          }
                          const blur = SAFETY_RANK[embedded.safety] > SAFETY_RANK[parentSafety];
                          return (
                            <Link
                              key={id}
                              href={`/post/${id}`}
                              title={`Post #${id}`}
                              className="group block h-32 w-32 overflow-hidden rounded-lg border border-secondary-border transition hover:border-darkerAccent"
                            >
                              <img
                                src={embedded.thumbnails.med}
                                alt={`Post #${id}`}
                                loading="lazy"
                                className={`h-full w-full object-cover transition duration-300 ${blur ? "blur-md group-hover:blur-none" : ""}`}
                              />
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}

                {/* Actions */}
                {!editing && (can("edit", comment) || can("delete", comment)) && (
                  <div className="mt-2 flex gap-3 text-xs text-zinc-500">
                    {can("edit", comment) && (
                      <button onClick={() => startEdit(comment)} className="inline-flex items-center gap-1 hover:text-white">
                        <PencilSimpleIcon size={12} /> Edit
                      </button>
                    )}
                    {can("delete", comment) && (
                      <button onClick={() => setDeleteId(comment.id)} className="inline-flex items-center gap-1 hover:text-red-400">
                        <TrashIcon size={12} /> Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      <ConfirmModal
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Delete Comment?"
        description="Are you sure you want to delete this comment? This cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}
