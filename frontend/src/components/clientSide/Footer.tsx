'use client';

import { formatStorageFromMB } from '@/core/formats';
import { LEGIBLE_VERSION } from '@/core/version';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function Footer() {
  const [storage, setStorage] = useState<string | null>(null);
  const [postCount, setPostCount] = useState<number | null>(null);
  const pathname = usePathname();
  const isFullscreen = pathname?.includes("/fullscreen");

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/system/stats');
        const data = await res.json();
        setStorage(formatStorageFromMB(data.totalMB));
        setPostCount(data.totalPosts);
      } catch (err) {
        console.error('Failed to fetch system stats:', err);
      }
    };
    fetchStats();
  }, []);

  if (isFullscreen) return null;

  return (
    <footer className="w-full border-t border-zinc-800 text-2xs md:text-sm text-gray-400 py-3 px-6 flex items-center justify-between bg-zinc-950">
      <div className="text-left">&copy; {new Date().getFullYear()} WWYDF</div>

      <div className="mx-0 mr-0 ml-auto text-right md:mx-auto md:text-center">
        {storage && postCount !== null
          ? `Total ${storage} used across ${postCount} posts`
          : 'Loading stats...'}
      </div>

      <div className="text-right">BooruParty {LEGIBLE_VERSION}</div>
    </footer>
  );
}
