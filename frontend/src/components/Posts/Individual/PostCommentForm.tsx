"use client";

import { useRef, useState } from "react";
import { PaperPlaneRightIcon, SmileyIcon } from "@phosphor-icons/react";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { useUser } from "@/components/UserProvider";
import { API, errorText } from "@/core/api";
import { CommentWriteResponse } from "@/core/types/comments";
import ReactionPicker from "./ReactionPicker";

export const MAX_COMMENT_LENGTH = 2000; // matches the API's limit

type Props = {
  postId: number;
  onPosted: (result: CommentWriteResponse) => void; // the new comment + its resolved embeds
};

export default function PostCommentForm({ postId, onPosted }: Props) {
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const { user } = useUser();

  const canPost = content.trim().length > 0 && !posting;
  const canEmbedPosts = user?.permissions.includes("comment.embed.post") ?? false;

  const handlePost = async () => {
    if (!canPost) return;
    setPosting(true);

    try {
      const res = await API(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        toast(errorText(data), "error");
        return;
      }

      setContent("");
      onPosted(data as CommentWriteResponse);
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setPosting(false);
    }
  };

  // Put ":id:" where the caret is (or replace the selection), with spaces so it's its own token
  const insertEmbed = (embedId: number) => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? content.length;
    const end = el?.selectionEnd ?? content.length;
    const before = content.slice(0, start);
    const after = content.slice(end);

    const token = `${before && !/\s$/.test(before) ? " " : ""}:${embedId}:${after.startsWith(" ") ? "" : " "}`;
    const next = (before + token + after).slice(0, MAX_COMMENT_LENGTH);
    setContent(next);

    // After React re-renders the new value: focus the box and put the caret after the embed
    const caret = Math.min(before.length + token.length, next.length);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="space-y-1">
      {/* The button grows with the textarea, even when it's resized */}
      <div className="flex items-stretch gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/⌘ + Enter posts; plain Enter is a new line
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handlePost();
            }
          }}
          rows={1}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="Write a comment..."
          className="min-h-[2.5rem] flex-1 resize-y rounded-lg border border-secondary-border bg-zinc-900 p-2 text-sm text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-600"
        />
        {canEmbedPosts && (
          <Button
            icon={<SmileyIcon size={18} />}
            onClick={() => setPickerOpen(true)}
            title="Reaction images"
            aria-label="Reaction images"
          />
        )}
        <Button variant="primary" icon={<PaperPlaneRightIcon size={16} />} loading={posting} disabled={!canPost} onClick={handlePost}>
          Post
        </Button>
      </div>

      {/* Only show the counter once it matters */}
      {content.length > MAX_COMMENT_LENGTH * 0.8 && (
        <p className="text-right text-xs text-subtle">{content.length} / {MAX_COMMENT_LENGTH}</p>
      )}

      {canEmbedPosts && (
        <ReactionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={insertEmbed} />
      )}
    </div>
  );
}
