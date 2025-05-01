export type Comments = {
  id: number;
  postId: number;
  content: string;
  createdAt: string;
  author: {
    id: string;
    username: string;
    role: {
      name: string;
    };
    avatar: string
  },
  isEmbed: boolean;
};
  