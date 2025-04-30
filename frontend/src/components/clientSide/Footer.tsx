'use client';

import { formatStorage } from '@/core/formats';
import { useEffect, useState } from 'react';

export default function Footer() {
  const [storage, setStorage] = useState<string | null>(null);
  const [postCount, setPostCount] = useState<number | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/system/stats');
        const data = await res.json();
        setStorage(formatStorage(data.totalMB));
        setPostCount(data.totalPosts);
      } catch (err) {
        console.error('Failed to fetch system stats:', err);
      }
    };
    fetchStats();
  }, []);

  return (
    <footer className="w-full border-t border-zinc-800 text-sm text-gray-400 py-3 px-6 flex items-center justify-between bg-zinc-950">
      <div className="text-left">&copy; {new Date().getFullYear()} AzzyX</div>

      <div className="text-center mx-auto">
        {storage && postCount !== null
          ? `Total ${storage} used across ${postCount} posts`
          : 'Loading stats...'}
      </div>
    </footer>
  );
}
