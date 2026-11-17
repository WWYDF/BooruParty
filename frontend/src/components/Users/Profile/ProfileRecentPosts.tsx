'use client';

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightIcon } from "@phosphor-icons/react";
import { API } from "@/core/api";
import { formatCounts } from "@/core/formats";
import { Posts } from "@/core/types/posts";

const SHOWN = 10;

// The user's uploads, through the normal feed (`from:`), so visibility and the viewer's safety defaults apply as usual
export default function ProfileRecentPosts({ username }: { username: string }) {
  const router = useRouter();
  const [posts, setPosts] = useState<Posts[] | null>(null);
  const [total, setTotal] = useState(0);
  const query = `from:${username}`;

  useEffect(() => {
    let cancelled = false;
    setPosts(null);

    API(`/api/posts?${new URLSearchParams({ q: query, limit: String(SHOWN) })}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setPosts([]); // e.g. guest access off: just no section
        const data = await res.json();
        setPosts(data.posts);
        setTotal(data.total ?? data.posts.length);
      })
      .catch(() => { if (!cancelled) setPosts([]); });

    return () => { cancelled = true; };
  }, [query]);

  if (!posts || posts.length === 0) return null;

  // Next/Previous on the post page then steps through this user's uploads
  const viewPost = (id: number) => {
    sessionStorage.setItem("lastSearchParams", JSON.stringify({ query, safety: "" }));
    router.push(`/post/${id}`);
  };

  return (
    <section>
      <h2 className="mb-2 text-lg font-semibold">
        Recent Posts <span className="text-sm text-subtle">({formatCounts(total)})</span>
      </h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => viewPost(post.id)}
            title={`Post #${post.id}`}
            className="block cursor-pointer rounded-lg border border-zinc-700 transition duration-200 hover:-translate-y-1.5 hover:border-darkerAccent hover:shadow-lg hover:shadow-accent/30"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.thumbnails.small} alt={`Post #${post.id}`} loading="lazy" className="aspect-4/3 w-full rounded-lg object-cover" />
          </button>
        ))}
      </div>
      {total > posts.length && (
        <Link
          href={`/posts?query=${encodeURIComponent(query)}`}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:border-black hover:bg-zinc-950"
        >
          View all posts
          <ArrowRightIcon size={16} />
        </Link>
      )}
    </section>
  );
}
