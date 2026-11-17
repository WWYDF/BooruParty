import { Prisma } from "../../../../prisma/client";
import { userSummarySelect } from "./summaries";

// A comment as shown under a post
export const commentSelect = {
  id: true,
  content: true,
  editedAt: true,
  createdAt: true,
  author: { select: userSummarySelect },
} satisfies Prisma.PostCommentSelect;

export type CommentRow = Prisma.PostCommentGetPayload<{ select: typeof commentSelect }>;