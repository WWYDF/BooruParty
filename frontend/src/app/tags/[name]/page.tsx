"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRightIcon, ImagesIcon, SmileyIcon } from "@phosphor-icons/react";
import { API } from "@/core/api";
import { formatCounts } from "@/core/formats";
import { Posts } from "@/core/types/posts";
import { RelatedTag, TagDetail, TagFlag } from "@/core/types/tags";
import { CategoryInfo } from "@/components/Posts/Individual/PostView";

const RECENT_POSTS = 12;

// How each flag is shown as a badge
const FLAG_BADGES: Record<TagFlag, { label: string; icon: React.ReactNode }> = {
  REACTION: { label: "Reaction image", icon: <SmileyIcon size={12} weight="bold" /> },
};

// Description text with links made clickable (plain text otherwise, never HTML)
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="text-accent hover:underline break-all">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function TagChip({ name, color }: { name: string; color?: string }) {
  return (
    <Link
      href={`/tags/${encodeURIComponent(name)}`}
      className="rounded-full border border-secondary-border bg-zinc-900/60 px-2.5 py-0.5 text-xs transition hover:border-zinc-600"
      style={{ color: color ?? "#fff" }}
    >
      {name}
    </Link>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-zinc-200">{title}</h3>
      {children}
    </div>
  );
}

export default function TagSummaryPage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const [tag, setTag] = useState<TagDetail | null>(null);
  const [categories, setCategories] = useState<Map<number, CategoryInfo>>(new Map());
  const [recent, setRecent] = useState<Posts[] | null>(null);
  const [redirectedFrom, setRedirectedFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!name) return;
    let cancelled = false;
    setTag(null);
    setRecent(null);
    setError(null);

    // "?from=alias" is set by the alias redirect below
    setRedirectedFrom(new URLSearchParams(window.location.search).get("from"));

    (async () => {
      try {
        const [tagRes, catRes] = await Promise.all([
          API(`/api/tags/${name}`), // already URL-encoded by the router
          API("/api/tag-categories"),
        ]);
        if (cancelled) return;

        if (!tagRes.ok) {
          setError(tagRes.status === 404 ? "Tag not found." : "Could not load this tag.");
          return;
        }

        const data: TagDetail = await tagRes.json();

        // Opened through an alias: move to the real name so links, the title and the URL agree
        if (data.matchedAlias) {
          router.replace(`/tags/${encodeURIComponent(data.name)}?from=${encodeURIComponent(data.matchedAlias)}`);
          return;
        }

        const cats: CategoryInfo[] = catRes.ok ? await catRes.json() : [];
        setCategories(new Map(cats.map((c) => [c.id, c])));
        setTag(data);

        // A taste of the tag. Needs browsing rights; if the viewer can't browse, the strip just doesn't show
        const params = new URLSearchParams({ q: data.name, limit: String(RECENT_POSTS) });
        const postsRes = await API(`/api/posts?${params}`);
        if (!cancelled && postsRes.ok) setRecent((await postsRes.json()).posts);
      } catch {
        if (!cancelled) setError("The server could not be reached.");
      }
    })();

    return () => { cancelled = true; };
  }, [name]);

  if (error) {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-red-400">{error}</p>
        <Link href="/tags" className="text-accent hover:underline">Browse all tags →</Link>
      </div>
    );
  }
  if (!tag) return <p className="text-sm text-zinc-600">Loading...</p>;

  const colorOf = (t: RelatedTag) => categories.get(t.categoryId)?.color;
  const directIds = new Set(tag.implications.map((t) => t.id));
  const indirect = tag.allImplications.filter((t) => !directIds.has(t.id)); // reached through a chain
  const postsHref = `/posts?query=${encodeURIComponent(tag.name)}`;

  return (
    <div className="space-y-6 text-sm">
      {redirectedFrom && (
        <p className="rounded-lg border border-secondary-border bg-zinc-900/60 px-3 py-2 text-xs text-subtle">
          <span className="text-zinc-300">{redirectedFrom}</span> is an alias of this tag.
        </p>
      )}

      {/* Category, flags, usage */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-secondary-border bg-zinc-900/60 px-3 py-1 text-xs"
          style={{ color: tag.category.color }}
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.category.color }} />
          {tag.category.name}
        </span>

        {tag.flags.map((flag) => (
          <span key={flag} className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs text-accent">
            {FLAG_BADGES[flag]?.icon}
            {FLAG_BADGES[flag]?.label ?? flag.toLowerCase()}
          </span>
        ))}

        <Link
          href={postsHref}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-secondary-border bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300 transition hover:border-zinc-600 hover:text-white"
        >
          <ImagesIcon size={14} />
          {formatCounts(tag.postCount)} {tag.postCount === 1 ? "post" : "posts"}
        </Link>
      </div>

      {/* Description */}
      <div className="whitespace-pre-wrap rounded-xl border border-secondary-border bg-zinc-900/40 px-4 py-3 text-zinc-300">
        {tag.description ? linkify(tag.description) : <span className="text-zinc-500">This tag has no description yet.</span>}
      </div>

      {tag.aliases.length > 0 && (
        <Section title="Also known as">
          <div className="flex flex-wrap gap-1.5">
            {tag.aliases.map((alias) => (
              <span key={alias} className="rounded-full border border-secondary-border bg-zinc-900/60 px-2.5 py-0.5 text-xs text-zinc-400">
                {alias}
              </span>
            ))}
          </div>
        </Section>
      )}

      {tag.implications.length > 0 && (
        <Section title="Implies">
          <div className="flex flex-wrap gap-1.5">
            {tag.implications.map((t) => <TagChip key={t.id} name={t.name} color={colorOf(t)} />)}
          </div>
          {indirect.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-zinc-500">and through those:</span>
              {indirect.map((t) => <TagChip key={t.id} name={t.name} color={colorOf(t)} />)}
            </div>
          )}
        </Section>
      )}

      {tag.suggestions.length > 0 && (
        <Section title="Often used with">
          <div className="flex flex-wrap gap-1.5">
            {tag.suggestions.map((t) => <TagChip key={t.id} name={t.name} color={colorOf(t)} />)}
          </div>
        </Section>
      )}

      {/* Recent posts */}
      {recent && recent.length > 0 && (
        <Section title="Recent posts">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
            {recent.map((post) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                title={`Post #${post.id}`}
                className="aspect-square overflow-hidden rounded-lg border border-secondary-border bg-zinc-950 transition hover:border-accent"
              >
                <img src={post.thumbnails.small} alt={`Post #${post.id}`} loading="lazy" className="h-full w-full object-cover" />
              </Link>
            ))}
          </div>
          {tag.postCount > recent.length && (
            <Link href={postsHref} className="mt-3 inline-flex items-center gap-1 text-xs text-subtle transition hover:text-accent">
              View all {formatCounts(tag.postCount)} posts <ArrowRightIcon size={12} />
            </Link>
          )}
        </Section>
      )}
    </div>
  );
}
