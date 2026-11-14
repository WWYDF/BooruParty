import { Prisma } from "../../../prisma/client";


// Fields that anyone can see about a user, used for stuff like comments or post authors
export const userSummarySelect = {
  id: true,
  username: true,
  private: true,
  lastSeen: true,
  updatedAt: true,
  createdAt: true,
  role: {
    select: {
      name: true,
      color: true,
      index: true
    }
  }
} satisfies Prisma.UserSelect;


// Extended info about a user, really only used for stuff like their profile
export const userProfileSelect = {
  ...userSummarySelect,
  createdAt: true,
  preferences: {
    select: {
      profileBackground: true
    }
  }
} satisfies Prisma.UserSelect;


export type UserSummary = Prisma.UserGetPayload<{ select: typeof userSummarySelect }>;
export type UserProfile = Prisma.UserGetPayload<{ select: typeof userProfileSelect }>;