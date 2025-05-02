export type Post = {
  id: number;
  fileExt: string;
  previewPath: string;
  anonymous: boolean;
  safety: 'SAFE' | 'SKETCHY' | 'UNSAFE';
  sources: string[];
  notes: string;
  flags: string[];
  previewScale: number;
  pHash: string;
  score: number;
  uploadedById: string;
  createdAt: string;
  favoritedBy: {
    userId: string;
  }[];
  uploadedBy: {
    id: string;
    username: string;
    role: string;
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
}

export type PostNavigatorType = {
  previousPostId: number;
  nextPostId: number;
}