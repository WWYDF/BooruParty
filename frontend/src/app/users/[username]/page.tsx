"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { ALLOWED_EMBED_SOURCES } from "@/core/dictionary";
import { motion } from "framer-motion";
import clsx from "clsx";
import { GearSix, SignOut } from "phosphor-react";
import { signOut, useSession } from "next-auth/react";
import { formatRelativeTime } from "@/core/formats";
import sanitizeHtml from "sanitize-html";
import { checkPermissions } from "@/core/permissions";
import { useToast } from "@/components/clientSide/Toast";
import { glowClassFromHex, hexToRgb } from "@/core/roles";


function hexToGlowShadow(hex: string, alpha = 0.3): string {
  if (!hex?.startsWith("#") || hex.length !== 7) return "";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `shadow-[0_0_20px_2px_rgba(${r},${g},${b},${alpha})]`;
}

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

export default function UserProfilePage() {
  const { username } = useParams() as { username: string };
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();
  const [canEdit, setCanEdit] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users/${username}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUser(data);
        setLoading(false);
      });
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

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent" />
        <span className="sr-only">Loading...</span>
      </div>
    );
  }
  if (!user) return <p className="p-6 text-red-500">User not found.</p>;
  const [r, g, b] = hexToRgb(user.role.color ?? '#000000');

  return (
    <main>
      <meta property="og:image" content={user.avatar || `/i/user.png`} />
      <meta name="theme-color" content={user.role?.color} />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-6xl mx-auto mt-16 mb-20 p-6 rounded-2xl bg-secondary border border-zinc-800 space-y-10"
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
              <p className="text-subtle italic inline-block px-2 bg-zinc-800 rounded text-sm mt-1 mb-2">{user.description}</p>
            )}

            <div className="text-sm text-subtle">
              Last seen: {formatRelativeTime(user.lastLogin)}
            </div>
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
                  href={session?.user?.username === user.username ? "/profile" : `/profile?as=${user.username}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-zinc-900 text-accent rounded-md border border-zinc-800 hover:bg-zinc-950 hover:border-black transition"
                >
                  <GearSix size={16} weight="bold" />
                  Edit Profile
                </a>

              {session?.user?.username === user.username && (
                <button
                  onClick={() => {
                    signOut({ callbackUrl: "/" })
                    toast('Successfully logged out!', 'success');
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
            <h2 className="text-lg font-semibold mb-2">Recent Posts <a className="text-sm text-subtle">({user._count.posts})</a></h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {user.posts.slice(0, 10).map((post: any) => (
              <a
                key={post.id}
                href={`/post/${post.id}`}
                className="block transform transition duration-200 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-accent/30 rounded-lg border border-zinc-700 hover:border-darkerAccent"
              >
                <img
                  src={`${process.env.NEXT_PUBLIC_FASTIFY}/data/thumbnails/${post.id}_small.webp`}
                  alt={`Post #${post.id}`}
                  className="w-full aspect-[4/3] object-cover rounded-lg"
                />
              </a>
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
            <h2 className="text-lg font-semibold mb-2">Recent Favorites <a className="text-sm text-subtle">({user._count.favorites})</a></h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {user.favorites.slice(0, 10).map((fav: any) => (
                <a
                key={fav.postId}
                href={`/post/${fav.postId}`}
                className="block transform transition duration-200 hover:-translate-y-1.5 hover:shadow-lg hover:shadow-accent/30 rounded-lg border border-zinc-700 hover:border-darkerAccent"
              >
                <img
                  src={`${process.env.NEXT_PUBLIC_FASTIFY}/data/thumbnails/${fav.postId}_small.webp`}
                  alt={`Post #${fav.postId}`}
                  className="w-full aspect-[4/3] object-cover rounded-lg"
                />
              </a>
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
            <h2 className="text-lg font-semibold mb-2">Recent Comments <a className="text-sm text-subtle">({user._count.comments})</a></h2>
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
                          allowedTags: [], // Disallow everything
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
