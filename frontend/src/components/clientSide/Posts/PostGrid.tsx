'use client';

import PostCard from './PostCard';
import { Posts } from '@prisma/client';

type ViewMode = 'GRID' | 'COLLAGE';

export default function PostGrid({
  externalPosts = [],
  viewMode = 'GRID'
}: {
  externalPosts?: Posts[];
  viewMode?: ViewMode;
}) {
  if (viewMode === 'COLLAGE') {
    return (
      <div className="columns-2 md:columns-3 gap-4">
        {externalPosts.map((post) => (
          <div key={post.id} className="mb-4 break-inside-avoid">
            <PostCard post={post} viewMode="COLLAGE" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {externalPosts.map((post) => (
        <PostCard key={post.id} post={post} viewMode="GRID" />
      ))}
    </div>
  );
}
