// app/users/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RoleBadge } from "@/components/serverSide/Users/RoleBadge";
import { useSearchParams, useRouter } from "next/navigation";
import clsx from "clsx";

type User = {
  id: string;
  username: string;
  avatar: string;
  description: string | null;
  role: { name: string };
  createdAt: string;
  lastLogin: string;
  _count: {
    favorites: number;
    comments: number;
  };
};

export default function UsersPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get("page") || "1");
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/users?page=${page}`)
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users);
        setTotalPages(data.totalPages);
        setLoading(false);
      });
  }, [page]);

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const then = new Date(dateString);
    const diff = Math.floor((+now - +then) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return then.toLocaleDateString();
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Users</h1>

      {loading ? (
        <p className="text-subtle text-sm">Loading users...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {users.map((user) => (
            <Link
              href={`/users/${user.username}`}
              key={user.id}
              className="bg-secondary rounded-xl p-4 hover:bg-secondary-border transition flex flex-col items-center text-center"
            >
              <img
                src={user.avatar}
                alt={user.username}
                className="w-20 h-20 rounded-full object-cover mb-3"
              />
              <div className="flex items-center justify-center text-accent font-semibold">
                {user.username}
                <RoleBadge role={user.role.name} variant="badge" />
              </div>

              {user.description && (
                <div className="text-xs text-zinc-600 mt-1 mb-1 italic max-w-[90%]">
                  {user.description}
                </div>
              )}

              <div className="text-subtle text-sm mt-1">
                Last seen: {formatRelativeTime(user.lastLogin)}
              </div>
              <div className="text-subtle text-sm">
                Registered: {formatRelativeTime(user.createdAt)}
              </div>

              <div className="text-xs text-zinc-500 mt-2">
                ❤️ {user._count.favorites} favorites • 💬 {user._count.comments} comments
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center items-center gap-2 pt-4 text-sm">
        {Array.from({ length: totalPages }, (_, i) => (
          <button
            key={i}
            onClick={() =>
              router.push(`/users?page=${i + 1}`)
            }
            className={clsx(
              "px-3 py-1 rounded border",
              page === i + 1
                ? "bg-accent border-accent text-white"
                : "border-zinc-700 hover:bg-zinc-800 text-subtle"
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
    </div>
  );
}
