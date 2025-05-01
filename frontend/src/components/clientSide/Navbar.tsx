'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCircle } from 'phosphor-react';

type UserInfo = {
  id: string;
  username: string;
  avatar: string;
  role: {
    name: string;
    permissions: { name: string }[];
  };
};

export default function Navbar() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/users/self')
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && data.username) {
          setUser(data); // logged-in user
        } else if (data?.role?.name === "GUEST") {
          setUser(data); // treat as guest with permissions
        } else {
          setUser(null); // fallback
        }
      });
  }, []);  

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasPerm = (perm: string) => user?.role?.permissions?.some((p) => p.name === perm);

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="w-full px-6 py-4 flex items-center justify-between bg-zinc-950 border-b border-zinc-800"
    >
      <Link href="/" className="text-xl font-semibold text-white">
        Imageboard
      </Link>

      <div className="flex gap-4 items-center text-sm text-subtle">
        <Link href="/posts" className="hover:text-white transition">Posts</Link>
        {hasPerm('post_create') && (
          <Link href="/upload" className="hover:text-white transition">Upload</Link>
        )}
        {hasPerm('dashboard_view') && (
          <Link href="/dashboard" className="hover:text-white transition">Dashboard</Link>
        )}
        {hasPerm("posts_view") && (
          <Link href="/users" className="hover:text-white transition">
            Users
          </Link>
        )}

        {/* Avatar or Login/Register */}
        {user?.username && user.avatar ? (
          <Link href={`/profile`}>
            <img
              src={user.avatar}
              alt={user.username}
              className="w-8 h-8 rounded-full object-cover border border-zinc-700 hover:border-accent transition"
            />
          </Link>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="text-subtle hover:text-accent transition focus:outline-none"
            >
              <UserCircle size={28} weight="fill" />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 mt-2 bg-zinc-900 border border-zinc-700 rounded-md shadow-md z-50 min-w-[120px]"
                >
                  <Link
                    href="/login"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-zinc-800"
                  >
                    Login
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setDropdownOpen(false)}
                    className="block px-4 py-2 text-sm hover:bg-zinc-800"
                  >
                    Register
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.nav>
  );
}
