'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { API } from "@/core/api";
import { ColoredTag } from "@/core/types/tags";

// "Favorite Tags (#/max)": the user's picks, already sorted by category order then name.
// Visitors only see it when there's something in it; the owner also gets it empty, with a link to add some.
export default function ProfileFavoriteTags({ tags, isOwner }: { tags: ColoredTag[]; isOwner: boolean }) {
  const [max, setMax] = useState<number | null>(null);

  // The cap is a site setting (public endpoint, no login needed)
  useEffect(() => {
    let cancelled = false;
    API("/api/system/settings")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((s: { maxFavoriteTags: number }) => { if (!cancelled) setMax(s.maxFavoriteTags); })
      .catch(() => { /* the count just shows without a max */ });
    return () => { cancelled = true; };
  }, []);

  if (tags.length === 0 && !isOwner) return null;
  if (max === 0 && tags.length === 0) return null; // favorites are turned off on this site

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">
        Favorite Tags{" "}
        <span className="text-sm tabular-nums text-subtle">
          ({tags.length}{max !== null && `/${max}`})
        </span>
      </h2>

      {tags.length === 0 ? (
        <Link
          href="/account"
          className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:border-black hover:bg-zinc-950"
        >
          Pick your favorite tags
          <ArrowRightIcon size={16} />
        </Link>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            // Same lift + accent border/glow as the post cards in Recent Posts
            <Link
              key={tag.id}
              href={`/posts?query=${encodeURIComponent(tag.name)}`}
              title={`${tag.category.name} · ${tag.postCount} posts`}
              className="flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900/60 px-3 py-1 text-sm text-zinc-200 transition duration-200 hover:-translate-y-0.5 hover:border-darkerAccent hover:text-white hover:shadow-md hover:shadow-accent/30"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: tag.category.color }} aria-hidden />
              {tag.name}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
