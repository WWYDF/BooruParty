"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { ALLOWED_EMBED_SOURCES } from "@/core/dictionary";
import { motion } from "framer-motion";
import { GearSix, SignOut, LockSimple } from "phosphor-react";
import { signOut, useSession } from "next-auth/react";
import { formatRelativeTime } from "@/core/formats";
import sanitizeHtml from "sanitize-html";
import { checkPermissions } from "@/core/permissions";
import { useToast } from "@/components/clientSide/Toast";
import { hexToRgb } from "@/core/roles";

function extractEmbeds(content: string): { type: "url" | "post"; value: string }[] {
  const embeds: { type: "url" | "post"; value: string }[] = [];
  const urlRegex = /https?:\/\/[^\s]+/g;
  const postRegex = /:(\d+):/g;

  const urls = content.match(urlRegex) || [];
  urls.forEach((url) => {
    try {
      const domain = new URL(url).hostname;
      if (Object.keys(ALLOWED_EMBED_SOURCES).some((d) => domain.endsWith(d))) {
        embeds.push({ type: "url", value: url });
      }
    } catch {}
  });

  let match;
  while ((match = postRegex.exec(content)) !== null) {
    embeds.push({ type: "post", value: match[1] });
  }

  return embeds;
}

function renderCommentEmbeds(embeds: { type: "url" | "post"; value: string }[]) {
  return embeds.map((embed, i) => {
    if (embed.type === "url") {
      return (
        <div key={`url-${i}`} className="mt-2">
          <img
            src={embed.value}
            alt="Embedded media"
            className="rounded-lg max-w-xs max-h-64 object-contain"
          />
        </div>
      );
    }

    if (embed.type === "post") {
      const thumb = `${process.env.NEXT_PUBLIC_FASTIFY}/data/thumbnails/${embed.value}_small.webp`;
      return (
        <div key={`post-${i}`} className="mt-2">
          <img
            src={thumb}
            alt={`Post ${embed.value}`}
            className="w-full max-w-xs rounded-lg object-cover aspect-[4/3]"
          />
        </div>
      );
    }

    return null;
  });
}

type PrivateError = { code: number; message: string } | null;

export default function UserProfilePage() {
  const { username } = useParams() as { username: string };
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PrivateError>(null);
  const { data: session } = useSession();
  const [canEdit, setCanEdit] = useState(false);
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setUser(null);

    fetch(`/api/users/${username}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          if (!cancelled) {
            if (data?.error === 403 || data?.error === 401) {
              setError({
                code: data?.error,
                message: data?.message || "This account is private.",
              });
            } else {
              setError({ code: res.status, message: data?.message || "Failed to load user." });
            }
            setUser(null);
          }
          return;
        }

        if (!cancelled) setUser(data);
      })
      .catch(() => {
        if (!cancelled) setError({ code: 500, message: "Failed to load user." });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    if (!user || !session?.user) return;

    const check = async () => {
      const isOwner = session.user.username === user.username;

      if (isOwner) {
        setCanEdit(true);
        return;
      }

      const perms = await checkPermissions(["profile_edit_others"]);
      setCanEdit(perms["profile_edit_others"]);
    };

    check();
  }, [user, session]);

  // Fetch the preview image for profile background (if set)
  useEffect(() => {
    let active = true;

    const maybeLoadBackground = async () => {
      try {
        const rawId = user?.preferences?.profileBackground;
        const idNum = Number(rawId);
        if (!rawId || !Number.isFinite(idNum) || idNum === 0) {
          setBgUrl(null);
          return;
        }

        const res = await fetch(`/api/posts/${idNum}`, { cache: "no-store" });
        if (!res.ok) {
          // If the post is missing or restricted, just skip background
          setBgUrl(null);
          return;
        }

        const post = await res.json();
        let url: string | null = post?.post?.previewPath || null;
        if (!url) {
          setBgUrl(null);
          return;
        }

        if (active) setBgUrl(url);
      } catch {
        if (active) setBgUrl(null);
      }
    };

    maybeLoadBackground();
    return () => {
      active = false;
    };
  }, [user?.preferences?.profileBackground]);

  // Loading
  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }

  // Private profile OR other fetch error
  if (error) {
    const isPrivate = error.code === 401 || error.code === 403;
    return (
      <main>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="max-w-2xl mx-auto mt-20 mb-24 p-6 rounded-2xl bg-secondary border border-zinc-800"
        >
          <div className="flex items-center gap-3 text-amber-400">
            {isPrivate && <LockSimple size={20} weight="bold" />}
            <h1 className="text-lg font-semibold">
              {isPrivate ? "This account is private." : "Unable to load profile."}
            </h1>
          </div>
          <p className="mt-2 text-subtle">
            {isPrivate
              ? "You don't have permission to view this profile."
              : error.message || "Something went wrong."}
          </p>
        </motion.div>
      </main>
    );
  }

  // Not found safety (just in case)
  if (!user) return <p className="p-6 text-red-500">User not found.</p>;

  const [r, g, b] = hexToRgb(user.role?.color ?? "#000000");
  const isOwner = session?.user?.username === user.username;
  const isPrivate = Boolean(user?.preferences?.private ?? false);

  function viewPost(type: "posts" | "favorites", postId: number) {
    let query = "";
    let sort = "";

    if (type === "posts") {
      query = `posts:${user.username}`;
    } else if (type === "favorites") {
      query = `favorites:${user.username}`;
    }

    localStorage.setItem(
      "lastSearchParams",
      JSON.stringify({
        query,
        sort,
      })
    );

    router.push(`/post/${postId}`);
  }

  return (
    <main className="relative pt-16 pb-20">
      {/* Meta */}
      <meta property="og:image" content={user.avatar || `/i/user.png`} />
      <meta name="theme-color" content={user.role?.color} />

      {/* NEW: Background layer (blurred, darkened, scaled) */}
      {bgUrl && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="absolute inset-0 blur-2xl transform scale-110"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url(${bgUrl})`,
              backgroundPosition: "center",
              backgroundSize: "cover",
              backgroundRepeat: "no-repeat",
              filter: "blur(3px)",
            }}
          />
        </div>
      )}

      {/* Owner-only banner for private accounts */}
      {isOwner && isPrivate && (
        <div className="max-w-6xl mx-auto mt-8">
          <div className="rounded-xl border border-amber-600/30 bg-amber-500/10 text-amber-300 px-4 py-3 text-sm">
            This profile is <span className="font-semibold">private</span>. Only you can see this page.
          </div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-6xl mx-auto p-6 rounded-2xl bg-secondary/80 backdrop-blur border border-zinc-800 space-y-10"
        style={{ boxShadow: `0 0 20px 2px rgba(${r},${g},${b},0.3)` }}
      >
        {/* Avatar + Username + Bio */}
        <div className="grid grid-cols-1 md:grid-cols-[100px_1fr_auto] gap-4 items-start">
          <img
            src={user.avatar || `/i/user.png`}
            alt={user.username}
            className="w-24 h-24 rounded-full object-cover border border-zinc-700"
          />

          <div className="">
            <div className="flex items-center text-2xl font-bold text-accent">
              {user.username}
              <RoleBadge role={user.role} />
            </div>

            {user.description && (
              <p className="text-subtle italic inline-block px-2 bg-zinc-800 rounded text-sm mt-1 mb-2">
                {user.description}
              </p>
            )}

            <div className="text-sm text-subtle">Last seen: {formatRelativeTime(user.lastLogin)}</div>
            <div className="text-xs text-subtle">
              Member Since: {new Date(user.createdAt).toLocaleDateString()}
            </div>
          </div>

          {canEdit && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-2"
            >
              <a
                href={isOwner ? "/profile" : `/profile?as=${user.username}`}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-zinc-900 text-accent rounded-md border border-zinc-800 hover:bg-zinc-950 hover:border-black transition"
              >
                <GearSix size={16} weight="bold" />
                Edit Profile
              </a>

              {isOwner && (
                <button
                  onClick={() => {
                    signOut({ callbackUrl: "/" });
                    toast("Successfully logged out!", "success");
                  }}
                  className="w-full inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-zinc-900 text-red-500 rounded-md border border-zinc-800 hover:bg-zinc-950 hover:border-black transition"
                >
                  <SignOut size={16} weight="bold" />
                  Log out
                </button>
              )}
            </motion.div>
          )}
        </div>

        {/* Recent Posts */}
        {user.posts?.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-2">
              Recent Posts <a className="text-sm text-subtle">({user._count.posts})</a>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {user.posts.slice(0, 10).map((post: any) => (
                <div
                  key={post.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    viewPost("posts", post.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      viewPost("posts", post.id);
                    }
                  }}
                  className="cursor-pointer block transform transition duration-200 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-accent/30 rounded-lg border border-zinc-700 hover:border-darkerAccent"
                >
                  <img
                    src={`${process.env.NEXT_PUBLIC_FASTIFY}/data/thumbnails/${post.id}_small.webp`}
                    alt={`Post #${post.id}`}
                    className="w-full aspect-[4/3] object-cover rounded-lg"
                  />
                </div>
              ))}
              {user.posts.length > 10 && (
                <div className="mt-2">
                  <div className="flex pr-1">
                    <a
                      href={`/posts?query=posts%3A${encodeURIComponent(user.username)}`}
                      className="px-3 py-1.5 text-sm font-medium bg-zinc-900 text-accent rounded-md border border-zinc-800 hover:bg-zinc-950 hover:border-black transition"
                    >
                      View all posts →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Recent Favorites */}
        {user.favorites?.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-2">
              Recent Favorites <a className="text-sm text-subtle">({user._count.favorites})</a>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {user.favorites.slice(0, 10).map((fav: any) => (
                <div
                  key={fav.postId}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    viewPost("favorites", fav.postId);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      viewPost("favorites", fav.postId);
                    }
                  }}
                  className="cursor-pointer block transform transition duration-200 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-accent/30 rounded-lg border border-zinc-700 hover:border-darkerAccent"
                >
                  <img
                    src={`${process.env.NEXT_PUBLIC_FASTIFY}/data/thumbnails/${fav.postId}_small.webp`}
                    alt={`Post #${fav.postId}`}
                    className="w-full aspect-[4/3] object-cover rounded-lg"
                  />
                </div>
              ))}

              {user.favorites.length > 10 && (
                <div className="mt-2">
                  <div className="flex pr-1">
                    <a
                      href={`/posts?query=favorites%3A${encodeURIComponent(user.username)}`}
                      className="px-3 py-1.5 text-sm font-medium bg-zinc-900 text-accent rounded-md border border-zinc-800 hover:bg-zinc-950 hover:border-black transition"
                    >
                      View all favorites →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Recent Comments */}
        {user.comments?.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-2">
              Recent Comments <a className="text-sm text-subtle">({user._count.comments})</a>
            </h2>
            <div className="space-y-3">
              {user.comments.map((comment: any) => {
                const embeds = extractEmbeds(comment.content);

                // Strip matched embed references from the content
                const cleanedText = embeds.reduce((text, embed) => {
                  if (embed.type === "url") {
                    return text.replace(embed.value, "").trim();
                  }
                  if (embed.type === "post") {
                    return text.replace(`:${embed.value}:`, "").trim();
                  }
                  return text;
                }, comment.content);

                return (
                  <a
                    key={comment.id}
                    href={`/post/${comment.postId}`}
                    className="block border border-zinc-800 p-3 rounded-lg hover:border-zinc-700 transition"
                  >
                    <div className="text-sm text-subtle whitespace-pre-wrap">
                      <span
                        className="inline-block break-all max-w-full"
                        dangerouslySetInnerHTML={{
                          __html: sanitizeHtml(cleanedText, {
                            allowedTags: [],
                            allowedAttributes: {},
                          }),
                        }}
                      />
                      {renderCommentEmbeds(embeds)}
                    </div>
                    <div className="text-xs text-zinc-500 mt-2">
                      {new Date(comment.createdAt).toLocaleString()}
                    </div>
                  </a>
                );
              })}
            </div>
          </section>
        )}
      </motion.div>
    </main>
  );
}
