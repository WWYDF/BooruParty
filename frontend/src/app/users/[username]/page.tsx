"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { roleGlowMap } from "@/core/dictionary";
import { motion } from "framer-motion";
import clsx from "clsx";
import { formatTimeAgo } from "@/core/formats";

export default function UserProfilePage() {
  const { username } = useParams() as { username: string };
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${username}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setUser(data);
        setLoading(false);
      });
  }, [username]);

  if (loading) return <p className="p-6 text-subtle text-sm">Loading profile...</p>;
  if (!user) return <p className="p-6 text-red-500">User not found.</p>;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={clsx(
        "max-w-6xl mx-auto mt-16 mb-20 p-6 rounded-2xl bg-secondary border border-zinc-800 space-y-10",
        roleGlowMap[user.role.name] || "" // fallback no glow
      )}
    >
      {/* Avatar + Username + Bio */}
      <div className="grid grid-cols-1 md:grid-cols-[100px_1fr] gap-4 items-center">
        <img
          src={user.avatar}
          alt={user.username}
          className="w-24 h-24 rounded-full object-cover border border-zinc-700"
        />

        <div className="">
          <div className="flex items-center gap-2 text-2xl font-bold text-accent">
            {user.username}
            <RoleBadge role={user.role.name} variant="badge" />
          </div>

          {user.description && (
            <p className="text-subtle italic inline-block px-2 bg-zinc-800 rounded text-sm mt-1 mb-2">{user.description}</p>
          )}

          <div className="text-sm text-subtle">
            Last seen: {formatTimeAgo(user.lastLogin)}
          </div>
          <div className="text-xs text-subtle">
            Member Since: {new Date(user.createdAt).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Recent Posts */}
      {user.posts?.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold mb-2">Recent Posts</h2>
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
          <h2 className="text-lg font-semibold mb-2">Recent Favorites</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {user.favorites.slice(0, 10).map((fav: any) => (
              <a
              key={fav.id}
              href={`/post/${fav.id}`}
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
          <h2 className="text-lg font-semibold mb-2">Recent Comments</h2>
          <div className="space-y-3">
            {user.comments.map((comment: any) => (
              <a
                key={comment.id}
                href={`/post/${comment.postId}`}
                className="block border border-zinc-800 p-3 rounded-lg hover:border-zinc-700 transition"
              >
                <div className="text-sm text-subtle whitespace-pre-wrap">
                  {comment.content}
                </div>
                <div className="text-xs text-muted mt-1">
                  {new Date(comment.createdAt).toLocaleString()}
                </div>
              </a>
            ))}
          </div>
        </section>
      )}
    </motion.div>
  );
}
