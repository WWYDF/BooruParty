'use client';

import { Post } from '../../../../types/posts';
import PostCard from './PostCard';

type ViewMode = 'GRID' | 'COLLAGE';

export default function PostGrid({
  externalPosts = [],
  viewMode = 'GRID'
}: {
  externalPosts?: Post[];
  viewMode?: ViewMode;
}) {
  if (viewMode === 'COLLAGE') {
    return (
      <div className="columns-2 md:columns-3 gap-4">
        {externalPosts.map((post, index) => (
          <div key={`${post.id}-${index}`} className="mb-4 break-inside-avoid">
            <PostCard post={post} viewMode="COLLAGE" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {externalPosts.map((post, index) => (
        <PostCard key={`${post.id}-${index}`} post={post} viewMode="GRID" />
      ))}
    </div>
  );
}
