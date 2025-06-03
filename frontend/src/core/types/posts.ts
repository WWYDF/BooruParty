import { Tag, TagGroup } from "./tags";

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