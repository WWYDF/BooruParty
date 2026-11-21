'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { renderText } from "@/components/Posts/Individual/PostCommentList";
import Button from "@/components/UI/Button";
import { useToast } from "@/components/UI/Toast";
import { API } from "@/core/api";
import { formatRelativeTime } from "@/core/formats";
import { EmbeddedPosts, UserComment, UserCommentPage } from "@/core/types/comments";

const PAGE_SIZE = 5;

// The user's latest comments, each next to the post it's on. The API only returns comments on posts
// this viewer would see in a list (safety, private uploaders, their blacklist), and nothing for private accounts.
export default function ProfileRecentComments({ username }: { username: string }) {
  const toast = useToast();
  const [comments, setComments] = useState<UserComment[] | null>(null);
  const [embeddedPosts, setEmbeddedPosts] = useState<EmbeddedPosts>({});
  const [cursor, setCursor] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPage = async (after: number | null): Promise<UserCommentPage | null> => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
    if (after) params.set("cursor", String(after));
    const res = await API(`/api/users/${encodeURIComponent(username)}/comments?${params}`);
    return res.ok ? res.json() : null;
  };

  useEffect(() => {
    let cancelled = false;
    setComments(null);

    fetchPage(null)
      .then((page) => {
        if (cancelled) return;
        if (!page) return setComments([]); // e.g. guest access off: just no section
        setComments(page.comments);
        setEmbeddedPosts(page.embeddedPosts);
        setCursor(page.nextCursor);
      })
      .catch(() => { if (!cancelled) setComments([]); });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(cursor);
      if (!page) return toast("Could not load more comments", "error");
      setComments((prev) => [...(prev ?? []), ...page.comments]);
      setEmbeddedPosts((prev) => ({ ...prev, ...page.embeddedPosts }));
      setCursor(page.nextCursor);
    } catch {
      toast("The server could not be reached", "error");
    } finally {
      setLoadingMore(false);
    }
  };

  if (!comments || comments.length === 0) return null;

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">Recent Comments</h2>

      <ul className="space-y-2">
        {comments.map((c) => {
          // Embeds in the order they appear: posts first (if still visible), then media. The first one leads the row.
          const embeds = [
            ...c.embeds.postIds.filter((id) => embeddedPosts[id]).map((id) => ({ key: `p${id}`, src: embeddedPosts[id].thumbnails.small, href: `/post/${id}`, title: `Post #${id}` })),
            ...c.embeds.media.map((url) => ({ key: url, src: url, href: null, title: "Embedded image" })),
          ];
          const lead = embeds[0];
          const text = renderText(c);
          const hasText = text.some((n) => typeof n !== "string" || n.trim() !== "");

          return (
            // Same lift + accent border/glow as the post cards. The whole card links to the post through a "stretched"
            // link underneath; the embed and links/@mentions in the text sit above it (relative z-10) and keep their own targets.
            <li
              key={c.id}
              className="relative flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900/40 p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-darkerAccent hover:shadow-lg hover:shadow-accent/30"
            >
              <Link
                href={`/post/${c.post.id}`}
                aria-label={`Comment on post #${c.post.id}`}
                title={`Post #${c.post.id} · ${new Date(c.createdAt).toLocaleString()}`}
                className="absolute inset-0 z-0 cursor-pointer rounded-lg"
              />

              {/* Far left: the comment's first embed (a +N badge if there are more) */}
              {/* Embedded posts link to themselves (raised above the card link); media is just a picture, so clicks fall through */}
              {lead && (
                <div className={`relative shrink-0 ${lead.href ? "z-10" : "pointer-events-none"}`}>
                  {lead.href ? (
                    <Link href={lead.href} title={lead.title} className="block overflow-hidden rounded-md border border-zinc-700 transition hover:border-darkerAccent">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={lead.src} alt={lead.title} loading="lazy" className="h-16 w-20 object-cover" />
                    </Link>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={lead.src} alt="" loading="lazy" className="h-16 w-20 rounded-md border border-zinc-700 object-cover" />
                  )}
                  {embeds.length > 1 && (
                    <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-2xs font-medium tabular-nums text-white">
                      +{embeds.length - 1}
                    </span>
                  )}
                </div>
              )}

              {/* Middle: the text, framed by big faint quote marks (same rendering as on the post page:
                  plain text, links and @mentions linkified). The marks are decoration only, hidden from screen readers. */}
              {hasText ? (
                // pointer-events-none: being `relative` (for the quotes) stacks this above the card link, so clicks
                // must pass through it. Links/@mentions in the text opt back in below.
                <div className="pointer-events-none relative min-w-0 flex-1 px-6 py-3">
                  <span aria-hidden className="pointer-events-none absolute -top-1 left-0 select-none font-serif text-5xl leading-none text-zinc-600/30">
                    &ldquo;
                  </span>
                  {/* Plain text clicks fall through to the card link; links/@mentions inside are raised above it */}
                  <p className="line-clamp-3 whitespace-pre-wrap wrap-break-word text-sm text-zinc-200 [&_a]:pointer-events-auto [&_a]:relative [&_a]:z-10">{text}</p>
                  <span aria-hidden className="pointer-events-none absolute -bottom-5 right-0 select-none font-serif text-5xl leading-none text-zinc-600/30">
                    &rdquo;
                  </span>
                </div>
              ) : (
                // Embed-only comment: nothing to quote, just keep the post info pushed to the right
                <div className="flex-1" />
              )}

              {/* Right: which post, when, then the post's thumbnail at the very end */}
              {/* Right: which post + when (plain text now: the whole card is the link), then the post's thumbnail */}
              <div className="hidden shrink-0 flex-col items-end gap-0.5 text-right text-xs text-zinc-500 sm:flex">
                <span className="text-zinc-400">Post #{c.post.id}</span>
                <span>{formatRelativeTime(c.createdAt)}</span>
              </div>

              <div className="w-20 shrink-0 overflow-hidden rounded-md border border-zinc-700 md:w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.post.thumbnails.small} alt="" loading="lazy" className="aspect-4/3 w-full object-cover" />
              </div>
            </li>
          );
        })}
      </ul>

      {cursor !== null && (
        <Button className="mt-3" loading={loadingMore} onClick={loadMore}>
          Show more
        </Button>
      )}
    </section>
  );
}
