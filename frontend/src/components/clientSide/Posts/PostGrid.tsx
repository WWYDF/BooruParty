'use client';

import { Post } from '@/core/types/posts';
import PostCard from './PostCard';
import Masonry from 'react-masonry-css';

type ViewMode = 'GRID' | 'COLLAGE';

export default function PostGrid({
  externalPosts = [],
  viewMode = 'GRID'
}: {
  externalPosts?: Post[];
  viewMode?: ViewMode;
}) {
  if (viewMode === 'COLLAGE') {
    const breakpointColumnsObj = {
      default: 4,
      1280: 3,
      768: 2,
      640: 1
    };

    return (
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="flex gap-4"
        columnClassName="bg-clip-padding"
      >
        {externalPosts.map((post, index) => (
          <div key={`${post.id}-${index}`} className="mb-4">
            <PostCard post={post} viewMode="COLLAGE" />
          </div>
        ))}
      </Masonry>
    );
  }

  // For GRID view (unchanged)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      {externalPosts.map((post, index) => (
        <PostCard key={`${post.id}-${index}`} post={post} viewMode="GRID" />
      ))}
    </div>
  );
}