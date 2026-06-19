import { Prisma, SafetyType } from "@prisma/client";
import { prisma } from "@/core/prisma";

const ALL_SAFETIES: SafetyType[] = ["SAFE", "UNSAFE", "SKETCHY"];

export function parseSearch(input: string) {
  const terms = input.split(/\s+/).filter(Boolean);
  const includeTags: string[] = [];
  const excludeTags: string[] = [];
  const systemOptions: Record<string, string> = {};

  for (const term of terms) {
    if (term.startsWith("-")) {
      excludeTags.push(term.substring(1));
    } else if (term.includes(":")) {
      const [key, value] = term.split(":");
      if (key && value) systemOptions[key] = value;
    } else {
      includeTags.push(term);
    }
  }

  const typeMatches = [...input.matchAll(/(-)?type:([^\s]+)/g)];
  const includeTypes: string[] = [];
  const excludeTypes: string[] = [];

  for (const [, isNegated, val] of typeMatches) {
    const lower = val.toLowerCase();
    if (isNegated) excludeTypes.push(lower);
    else includeTypes.push(lower);
  }

  return { includeTags, excludeTags, includeTypes, excludeTypes, systemOptions };
}

export interface PostQueryOptions {
  rawQuery?: string;
  safety?: string[];
  sort?: "new" | "old";
  tagBlacklist?: string[];
}

export function buildPostQuery({
  rawQuery = "",
  safety = [],
  sort = "new",
  tagBlacklist = [],
}: PostQueryOptions) {
  const parsed = parseSearch(rawQuery);
  const { includeTags, excludeTags, includeTypes, excludeTypes, systemOptions } = parsed;

  const conditions: Prisma.PostsWhereInput[] = [];

  for (const tag of includeTags) {
    conditions.push({ tags: { some: { name: tag } } });
  }
  for (const tag of excludeTags) {
    conditions.push({ tags: { none: { name: tag } } });
  }

  const activeBlacklist = tagBlacklist.filter(tag => !excludeTags.includes(tag));
  for (const tag of activeBlacklist) {
    conditions.push({ tags: { none: { name: { equals: tag, mode: "insensitive" } } } });
  }

  if (systemOptions.posts) {
    conditions.push({
      uploadedBy: { username: { equals: systemOptions.posts, mode: "insensitive" } },
    });
  }

  if (systemOptions.pool) {
    const poolIds = systemOptions.pool.split(",").map(Number).filter(n => !isNaN(n));
    if (poolIds.length > 0) {
      conditions.push({ pools: { some: { poolId: { in: poolIds } } } });
    }
  }

  if (systemOptions.favorites) {
    conditions.push({
      favoritedBy: {
        some: { user: { username: { equals: systemOptions.favorites, mode: "insensitive" } } },
      },
    });
  }

  if (systemOptions.likes) {
    conditions.push({
      votes: {
        some: {
          type: "UPVOTE",
          user: { is: { username: { equals: systemOptions.likes, mode: "insensitive" } } },
        },
      },
    });
  }

  if (systemOptions.filter === "tumbleweed" || systemOptions.filter === "tumbleweeds") {
    conditions.push({ tags: { none: {} } });
  }

  if (systemOptions.collection) {
    conditions.push({ collections: { some: { collectionId: systemOptions.collection } } });
  }

  const safeties = [...new Set(
    safety
      .map(s => s.trim().toUpperCase())
      .filter((s): s is SafetyType => ALL_SAFETIES.includes(s as SafetyType))
  )];
  if (safeties.length > 0) {
    conditions.push({ safety: { in: safeties } });
  }

  if (includeTypes.length > 0) conditions.push({ type: { in: includeTypes } });
  if (excludeTypes.length > 0) conditions.push({ type: { notIn: excludeTypes } });

  const dir = (suffix: string): "asc" | "desc" =>
    systemOptions.order?.endsWith(suffix) ? "asc" : "desc";
  const base: Prisma.PostsOrderByWithRelationInput = { createdAt: sort === "old" ? "asc" : "desc" };
  const tie: Prisma.PostsOrderByWithRelationInput = { id: "desc" };

  let orderBy: Prisma.PostsOrderByWithRelationInput[];
  if (systemOptions.order?.startsWith("date")) {
    orderBy = [{ createdAt: dir("_asc") }, tie];
  } else if (systemOptions.order?.startsWith("score")) {
    orderBy = [{ score: dir("_asc") }, base, tie];
  } else if (systemOptions.order?.startsWith("favorites")) {
    orderBy = [{ favoritedBy: { _count: dir("_asc") } }, base, tie];
  } else if (systemOptions.order?.startsWith("tags")) {
    orderBy = [{ tags: { _count: dir("_asc") } }, base, tie];
  } else if (systemOptions.order?.startsWith("boosts")) {
    orderBy = [{ boosts: { _count: dir("_asc") } }, base, tie];
  } else {
    orderBy = [base, tie];
  }

  return {
    where: (conditions.length > 0 ? { AND: conditions } : {}) as Prisma.PostsWhereInput,
    orderBy,
    parsed,
  };
}

export type PostQueryResult = ReturnType<typeof buildPostQuery>;

export async function fetchOrderedPosts(
  query: PostQueryResult,
  select: Prisma.PostsSelect,
  pagination?: { skip: number; take: number }
): Promise<any[]> {
  const { where, orderBy } = query;
  return prisma.posts.findMany({ where, orderBy, ...(pagination ?? {}), select });
}
