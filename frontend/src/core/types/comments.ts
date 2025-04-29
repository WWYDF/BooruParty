export type Comments = {
  id: number;
  postId: number;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    role: string;
    avatar: string
  }
};
  