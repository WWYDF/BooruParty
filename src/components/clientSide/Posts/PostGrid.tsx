'use client';

import { useEffect, useState } from 'react';
import { getSession } from 'next-auth/react';
import PostCard from './PostCard';
import { Posts } from '@prisma/client';

type ViewMode = 'GRID' | 'COLLAGE';

export default function PostGrid() {
  const [posts, setPosts] = useState<Posts[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('GRID');

  useEffect(() => {
    async function fetchPostsAndUser() {
      const session = await getSession();
      if (!session?.user?.id) return;

      const [userRes, postsRes] = await Promise.all([
        fetch(`/api/users/${session.user.id}`),
        fetch('/api/posts'), // or wherever your posts come from
      ]);

      const userData = await userRes.json();
      const postsData = await postsRes.json();

      setViewMode(userData?.preferences?.layout || 'GRID');
      setPosts(postsData);
    }

    fetchPostsAndUser();
  }, []);

  if (viewMode === 'COLLAGE') {
    return (
      <div className="columns-2 md:columns-3 gap-4">
        {posts.map((post) => (
          <div key={post.id} className="mb-4 break-inside-avoid">
            <PostCard post={post} viewMode="COLLAGE" />
          </div>
        ))}
      </div>
    );
  }

  // Default to grid layout
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {posts.map((post) => (
        <PostCard key={post.id} post={post} viewMode="GRID" />
      ))}
    </div>
  );
}
