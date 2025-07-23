import { Tag, TagGroup } from "./tags";

// Returned when searching an individual post
export type Post = {
  id: number;
  fileExt: string;
  previewPath: string;
  aspectRatio?: number;
  anonymous: boolean;
  safety: 'SAFE' | 'SKETCHY' | 'UNSAFE';
  sources: string[];
  notes: string;
  flags: string[];
  previewScale: number;
  fileSize?: number;
  pHash: string;
  score: number;
  uploadedById: string;
  createdAt: string;
  tags: TagGroup[]
  uploadedBy: {
    id: string;
    username: string;
    role: {
      name: string;
      color?: string;
    };
    avatar: string;
  };
  comments: {
    id: number;
    author: {
      id: string;
      username: string;
      role: string;
      avatar: string;
    };
    content: string;
    createdAt: string;
  }[];
  specialPosts: {
    id: number,
    label: string,
    postId: number,
    createdAt: Date
  }[];
  relatedFrom: {
    to: {
      id: number;
      previewPath: string | null;
    };
  }[];
  relatedTo: {
    from: {
      id: number;
      previewPath: string | null;
    };
  }[];
  pools: {
    poolId: number;
    pool: {
      id: number;
      name: string;
      safety: "SAFE" | "SKETCHY" | "UNSAFE";
      _count: {
        items: number;
      },
      items: {
        index: number;
        post: {
          id: number;
          previewPath: string | null;
        };
      }[];
    };
  }[];
  _count: {
    favoritedBy: number;
    tags: number;
  };
}

export type PostUserStatus = {
  vote: 'UPVOTE' | 'DOWNVOTE' | null,
  favorited: boolean
  signedIn: boolean
}

export type PostNavigatorType = {
  previousPostId: number;
  nextPostId: number;
}

// Returned when searching the Posts page(s)
export type Posts = {
  id: number;
  fileExt: string;
  safety: "SAFE" | "SKETCHY" | "UNSAFE";
  uploadedBy: {
    id: string;
    username: string;
  };
  anonymous: boolean;
  flags: string[];
  score: number;
  _count: {
    favoritedBy: number;
    comments: number;
    votes: number;
  };
  createdAt: Date;
  relatedFrom: {
    toId: number
  }[];
  pools: {
    poolId: number
  }[];
  tags: Tag[];
};


// Fastify Response
export type FastifyUpload = {
  status: string,
  postId: number,
  previewScale: number | null,
  aspectRatio: number,
  deletedPreview?: boolean,
  fileName?: string
  assignedExt: 'mp4' | 'webm' | 'mkv' | 'webp' | 'gif' | null,
}