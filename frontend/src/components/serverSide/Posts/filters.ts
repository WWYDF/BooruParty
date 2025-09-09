import { FILE_TYPE_MAP } from "@/core/dictionary";
import { SafetyType } from "@prisma/client";
import { parseSearch } from "./parseSearch";

export function buildPostWhereAndOrder(
  rawQuery: string,
  safety?: string | string[],
  sort: "new" | "old" = "new",
  tagBlacklist?: string[]
) {
  const { includeTags, excludeTags, includeTypes, excludeTypes, systemOptions } = parseSearch(rawQuery);

  const where: any = { AND: [] };
  let useFavoriteOrdering = false;
  let useLikesOrdering = false;

  // Tags
  includeTags.forEach(tag => where.AND.push({ tags: { some: { name: tag } } }));
  excludeTags.forEach(tag => where.AND.push({ tags: { none: { name: tag } } }));

  if (tagBlacklist?.length) {
    const cleanedBlacklist = tagBlacklist?.filter(tag => !excludeTags.includes(tag)) ?? [];
    cleanedBlacklist.forEach(tag => {
      where.AND.push({ tags: { none: { name: { equals: tag, mode: "insensitive" } } } });
    });
  }

  // Uploader
  if (systemOptions.posts) {
    where.AND.push({
      uploadedBy: {
        username: {
          equals: systemOptions.posts,
          mode: "insensitive",
        },
      },
    });
  }

  // Pools
  if (systemOptions.pool) {
    const rawPool = systemOptions.pool;
    const poolIds = (typeof rawPool === "string" ? rawPool.split(",") : rawPool)
      .map((p) => parseInt(p))
      .filter((n) => !isNaN(n));

    if (poolIds.length > 0) {
      where.AND.push({
        pools: {
          some: {
            poolId: { in: poolIds },
          },
        },
      });
    }
  }

  // Favorited by
  if (systemOptions.favorites) {
    useFavoriteOrdering = true;
    where.AND.push({
      favoritedBy: {
        some: {
          user: {
            username: {
              equals: systemOptions.favorites,
              mode: "insensitive",
            },
          },
        },
      },
    });
  }

  // Liked by
  if (systemOptions.likes) {
    useLikesOrdering = true;
    where.AND.push({
      votes: {
        some: {
          type: "UPVOTE",
          user: {
            is: {
              username: {
                equals: systemOptions.likes,
                mode: "insensitive",
              },
            },
          },
        },
      },
    });
  }

  // Safety filter — accept array or hyphenated string, enforce exact enum matches
  const allSafeties: SafetyType[] = ["SAFE", "UNSAFE", "SKETCHY"];
  if (safety && (Array.isArray(safety) ? safety.length : safety.trim().length)) {
    const raw = Array.isArray(safety) ? safety : safety.split("-");
    const normalized = raw
      .map(s => s.trim().toUpperCase())
      .filter(Boolean);

    const safeties = normalized.filter(
      (s): s is SafetyType => allSafeties.includes(s as SafetyType)
    );

    const uniqueSafeties = [...new Set(safeties)];

    if (uniqueSafeties.length > 0) {
      where.AND.push({ safety: { in: uniqueSafeties } }); // exact enum match
    }

    // Optional debug:
    // console.log("Raw safety input:", safety);
    // console.log("Resolved safeties:", uniqueSafeties);
    // console.log("Final where clause:", JSON.stringify(where, null, 2));
  }

  // File type filters
  const resolveExts = (types: string[]) =>
    types.flatMap(t => (t in FILE_TYPE_MAP ? FILE_TYPE_MAP[t as keyof typeof FILE_TYPE_MAP] : [t]))
      .map(ext => ext.replace(/^\./, ""));

  const includeExts = resolveExts(includeTypes);
  const excludeExts = resolveExts(excludeTypes);

  if (includeExts.length > 0) where.AND.push({ fileExt: { in: includeExts } });
  if (excludeExts.length > 0) where.AND.push({ fileExt: { notIn: excludeExts } });

  // Year filter
  if (systemOptions.year?.match(/^\d{4}$/)) {
    where.AND.push({ yearStart: parseInt(systemOptions.year) });
  }

  // Order
  let orderBy: any = { createdAt: sort === "old" ? "asc" : "desc" };

  if (systemOptions.order?.startsWith("score")) {
    orderBy = { score: systemOptions.order.endsWith("_asc") ? "asc" : "desc" };
  } else if (systemOptions.order?.startsWith("favorites")) {
    orderBy = { favoritedBy: { _count: systemOptions.order.endsWith("_asc") ? "asc" : "desc" } };
  } else if (systemOptions.order?.startsWith("tags")) {
    orderBy = {
      tags: { _count: systemOptions.order.endsWith("_asc") ? "asc" : "desc" },
    };
  }

  return { where, orderBy, useFavoriteOrdering, useLikesOrdering };
}
