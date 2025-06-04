// @/core/posts/filters.ts
import { FILE_TYPE_MAP } from "@/core/dictionary";
import { SafetyType } from "@prisma/client";
import { parseSearch } from "./parseSearch";

export function buildPostWhereAndOrder(rawQuery: string, safety?: string, sort: "new" | "old" = "new") {
  const { includeTags, excludeTags, includeTypes, excludeTypes, systemOptions } = parseSearch(rawQuery);

  const where: any = { AND: [] };
  let useFavoriteOrdering = false;

  // Tags
  includeTags.forEach(tag => where.AND.push({ tags: { some: { name: tag } } }));
  excludeTags.forEach(tag => where.AND.push({ tags: { none: { name: tag } } }));

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

  // Safety filter
  if (safety) {
    const safeties = safety.split("-").filter(Boolean) as SafetyType[];
    if (safeties.length > 0) {
      where.AND.push({ safety: { in: safeties } });
    }
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
  }

  // console.log(useFavoriteOrdering)

  return { where, orderBy, useFavoriteOrdering };
}
