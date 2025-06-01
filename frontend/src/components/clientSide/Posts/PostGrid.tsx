'use client';

import { Post } from '@/core/types/posts';
import PostCard from './PostCard';
import Masonry from 'react-masonry-css';
import { motion } from "framer-motion";

type ViewMode = 'GRID' | 'COLLAGE';

export default function PostGrid({
  externalPosts = [],
  viewMode = 'GRID',
  selectionMode,
  selectedPostIds,
  toggleSelect
}: {
  externalPosts?: Post[];
  viewMode?: ViewMode;
  selectionMode: boolean;
  selectedPostIds: number[];
  toggleSelect: (postId: number) => void;
}) {
  if (viewMode === 'COLLAGE') {
    const breakpointColumnsObj = {
      default: 4,
      3840: 8,
      2560: 6,
      1920: 4,
      1280: 3,
      768: 2,
      640: 2
    };

    return (
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="flex gap-4"
        columnClassName="bg-clip-padding"
      >
        {externalPosts.map((post, index) => (
          <div key={`${post.id}-${index}`} className="mb-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04, duration: 0.3 }}
            >
              <PostCard 
                key={`${post.id}`} 
                post={post} 
                viewMode="COLLAGE"
                selectionMode={selectionMode}
                isSelected={selectedPostIds.includes(post.id)}
                toggleSelect={toggleSelect}
              />
            </motion.div>
          </div>
        ))}
      </Masonry>
    );
  }

  // For GRID view (unchanged)
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
      {externalPosts.map((post, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04, duration: 0.3 }}
        >
          <PostCard 
            key={`${post.id}`} 
            post={post} 
            viewMode="GRID"
            selectionMode={selectionMode}
            isSelected={selectedPostIds.includes(post.id)}
            toggleSelect={toggleSelect}
          />
        </motion.div>
      ))}
    </div>
  );
}