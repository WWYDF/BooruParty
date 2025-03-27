export type RawComment = {
    id: number;
    postId: number;
    authorId: string;
    content: string;
    createdAt: string;
  };
  
export type ResolvedComment = RawComment & {
    authorName: string;
};
  