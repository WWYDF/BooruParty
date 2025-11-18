'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Images, List, X, UserCircle, Users, ChartPie, UploadSimple, House } from '@phosphor-icons/react';
import { NavItem } from './NavItem';
import { usePathname, useRouter } from "next/navigation";
import { FolderOpen, HouseLine, Tag } from 'phosphor-react';


type UserInfo = {
  id: string;
  username?: string;
  avatar?: string;
  role: {
    name: string;
    permissions: { name: string }[];
  };
};

export default function Navbar() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const pathname = usePathname();
  const isFullscreen = pathname?.includes("/fullscreen");
  const router = useRouter();

  useEffect(() => {
    fetch('/api/users/self')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.username) setUser(data);
        else if (data?.role?.name === 'GUEST') setUser(data);
        else setUser(null);
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
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const sidebar = sidebarRef.current;
    if (!sidebar) return;
  
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
    };
  
    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartX.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      if (deltaX > 60) setSidebarOpen(false); // swipe right
    };
  
    sidebar.addEventListener('touchstart', handleTouchStart);
    sidebar.addEventListener('touchend', handleTouchEnd);
  
    return () => {
      sidebar.removeEventListener('touchstart', handleTouchStart);
      sidebar.removeEventListener('touchend', handleTouchEnd);
    };
  }, []);

  const hasPerm = (perm: string) =>
    user?.role?.permissions?.some((p) => p.name === perm);

  if (isFullscreen) return null;

  return (
    <>
      {/* Main Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full px-6 py-4 flex items-center justify-between bg-zinc-950 border-b border-zinc-800 md:sticky top-0 z-30"
      >
        <>
          <button
            onClick={() => { window.location.replace('/posts'); }}
            className="text-xl font-semibold text-white md:hidden"
          >
            {process.env.NEXT_PUBLIC_SITE_NAME ?? "Imageboard"}
          </button>

          <Link
            href="/"
            className="text-xl font-semibold text-white hidden md:inline ml-2"
          >
            {process.env.NEXT_PUBLIC_SITE_NAME ?? "Imageboard"}
          </Link>
        </>

        {/* Desktop Links */}
        <div className="hidden md:flex gap-4 items-center text-sm text-subtle">
          <NavItem href="/posts">Posts</NavItem>
          {hasPerm('post_view') && (
            <NavItem href="/pools">Pools</NavItem>
          )}
          {hasPerm('post_create') && (
            <NavItem href="/upload">Upload</NavItem>
          )}
          {hasPerm('post_view') && (
            <NavItem href="/tags">Tags</NavItem>
          )}
          {hasPerm('dashboard_view') && (
            <NavItem href="/dashboard">Dashboard</NavItem>
          )}
          {hasPerm('post_view') && (
            <NavItem href="/users">Users</NavItem>
          )}
          {user?.username ? (
            <Link href={`/users/${user?.username}`}>
              <img
                src={user.avatar || `/i/user.png`}
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

        {/* Mobile Hamburger */}
        <button
          className="md:hidden text-white"
          onClick={() => setSidebarOpen(true)}
        >
          <List size={28} />
        </button>
      </motion.nav>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            ref={sidebarRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black bg-opacity-50 flex justify-end md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <motion.div
              className="w-64 h-full bg-zinc-900 border-l border-zinc-700 p-4 space-y-4"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ duration: 0.25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <span className="text-white font-semibold text-lg">Menu</span>
                <button onClick={() => setSidebarOpen(false)}>
                  <X size={24} className="text-subtle hover:text-white" />
                </button>
              </div>
              <nav className="flex flex-col gap-3 text-md text-subtle">
                <NavItem href="/" icon={<House size={18} />} onClick={() => setSidebarOpen(false)}>
                  Home
                </NavItem>
                <NavItem
                  href={pathname === "/posts" ? "#" : "/posts"}
                  icon={<Images size={18} />}
                  onClick={(e) => {
                    setSidebarOpen(false)
                    if (pathname === "/posts") {
                      e.preventDefault();
                      window.location.href = "/posts";
                    }
                  }}
                >
                  Posts
                </NavItem>
                {hasPerm('post_view') && (
                  <NavItem href="/pools" icon={<FolderOpen size={18} />} onClick={() => setSidebarOpen(false)}>
                    Pools
                  </NavItem>
                )}
                {hasPerm('post_view') && (
                  <NavItem href="/tags" icon={<Tag size={18} />} onClick={() => setSidebarOpen(false)}>
                    Tags
                  </NavItem>
                )}
                {hasPerm('post_create') && (
                  <NavItem href="/upload" icon={<UploadSimple size={18} />} onClick={() => setSidebarOpen(false)}>
                    Upload
                  </NavItem>
                )}
                {hasPerm('dashboard_view') && (
                  <NavItem href="/dashboard" icon={<ChartPie size={18} />} onClick={() => setSidebarOpen(false)}>
                    Dashboard
                  </NavItem>
                )}
                {hasPerm('post_view') && (
                  <NavItem href="/users" icon={<Users size={18} />} onClick={() => setSidebarOpen(false)}>
                    Users
                  </NavItem>
                )}
                {user?.username ? (
                  <NavItem href={`/users/${user?.username}`} icon={<UserCircle size={18} />} onClick={() => setSidebarOpen(false)}>
                    My Profile
                  </NavItem>
                ) : (
                  <>
                    <Link href="/login" onClick={() => setSidebarOpen(false)} className="hover:text-white">Login</Link>
                    <Link href="/register" onClick={() => setSidebarOpen(false)} className="hover:text-white">Register</Link>
                  </>
                )}
              </nav>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
