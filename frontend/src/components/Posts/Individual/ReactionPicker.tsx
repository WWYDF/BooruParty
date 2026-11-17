"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlassIcon, SmileyIcon } from "@phosphor-icons/react";
import InfoModal from "@/components/UI/Modals/InfoModal";
import Button from "@/components/UI/Button";
import { API, errorText } from "@/core/api";
import { Posts } from "@/core/types/posts";

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (postId: number) => void; // the caller inserts ":id:" into the comment
};

const PAGE_SIZE = 40;
const DEBOUNCE_MS = 300;

// Reaction images = the normal feed narrowed with the flag:reaction system term,
// so the same safety/privacy rules apply and the user can search inside it ("smug", "-cat", ...)
export default function ReactionPicker({ open, onClose, onPick }: Props) {
  const [text, setText] = useState("");
  const [posts, setPosts] = useState<Posts[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0); // ignore answers to searches the user already typed past

  const load = async (search: string, after: string | null) => {
    const id = ++requestId.current;
    const params = new URLSearchParams({ q: `flag:reaction ${search}`.trim(), limit: String(PAGE_SIZE) });
    if (after) params.set("cursor", after);
    setLoading(true);

    try {
      const res = await API(`/api/posts?${params}`);
      const data = await res.json().catch(() => ({}));
      if (id !== requestId.current) return;

      if (!res.ok) {
        setError(errorText(data));
        if (!after) setPosts([]);
        setCursor(null);
        return;
      }

      setError(null);
      setPosts((prev) => (after ? [...prev, ...data.posts] : data.posts));
      setCursor(data.nextCursor);
    } catch {
      if (id === requestId.current) setError("The server could not be reached");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // (Re)search while open; typing waits a moment so every keystroke isn't a request
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => load(text, null), text ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [open, text]);

  const pick = (postId: number) => {
    onPick(postId);
    onClose();
  };

  return (
    <InfoModal
      open={open}
      onClose={onClose}
      icon={<SmileyIcon size={24} className="text-accent" />}
      title="Reaction Images"
      subtitle="Click one to embed it in your comment."
    >
      <div className="space-y-3">
        {/* Search inside the reaction images */}
        <div className="flex items-center gap-2 rounded-lg border border-secondary-border bg-zinc-950 px-3">
          <MagnifyingGlassIcon size={16} className="shrink-0 text-subtle" />
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search by tags (e.g. smug)"
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className="w-full bg-transparent py-2 text-sm text-white focus:outline-none"
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {!error && !loading && posts.length === 0 && (
          <p className="py-8 text-center text-sm text-subtle">
            {text ? "No reaction images match that search." : "No reaction images yet. Flag a tag as REACTION to fill this up."}
          </p>
        )}

        {posts.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {posts.map((post) => (
              <button
                key={post.id}
                type="button"
                onClick={() => pick(post.id)}
                title={`Post #${post.id}`}
                className="aspect-square overflow-hidden rounded-lg border border-secondary-border bg-zinc-950 transition hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              >
                <img src={post.thumbnails.small} alt={`Post #${post.id}`} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {cursor && (
          <div className="flex justify-center">
            <Button size="sm" loading={loading} onClick={() => load(text, cursor)}>
              Load more
            </Button>
          </div>
        )}
      </div>
    </InfoModal>
  );
}
