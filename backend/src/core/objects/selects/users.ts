import { Prisma } from "../../../../prisma/client";
import { userSummarySelect } from "./summaries";

// Extended info about a user, used for their profile page
export const userProfileSelect = {
  ...userSummarySelect,
  preferences: { select: { profileBackground: true } },
} satisfies Prisma.UserSelect;

export type UserProfile = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;
